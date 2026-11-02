#!/usr/bin/env python3
"""Read-only consistency checks for the two existing local qualification formats."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

LIMIT = 8 * 1024 * 1024
SUPPORTED = {'public-post', 'thread-reply', 'private-post', 'delete-existing',
             'propose-work', 'accept-work', 'start-work'}
MODES = {'cold-while-pending', 'cold-after-publication-control'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate JSON field: ' + key)
            result[key] = value
        return result
    def invalid(value):
        raise ValueError('Non-finite JSON number: ' + value)
    return json.loads(text, object_pairs_hook=pairs, parse_constant=invalid)


def read_inside(root, path):
    root = Path(os.path.abspath(root))
    canonical_root = root.resolve()
    path = Path(path)
    require(path.is_absolute(), 'Internal artifact path must be absolute')
    lexical = Path(os.path.abspath(path))
    require(lexical.is_relative_to(root), 'Artifact escapes declared evidence root')
    cursor = root
    for part in lexical.relative_to(root).parts:
        cursor /= part
        require(not cursor.is_symlink(), 'Symlink artifacts are refused')
    resolved = lexical.resolve()
    require(resolved.is_relative_to(canonical_root), 'Artifact escapes declared evidence root')
    descriptor = os.open(resolved, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as handle:
        require(stat.S_ISREG(os.fstat(handle.fileno()).st_mode), 'Artifact must be a regular file')
        data = handle.read(LIMIT + 1)
    require(len(data) <= LIMIT, 'Artifact exceeds 8MiB inspection limit')
    return data


def check_hash(data, expected, label):
    require(isinstance(expected, str) and re.fullmatch('[a-f0-9]{64}', expected), label + ' needs a SHA256')
    require(hashlib.sha256(data).hexdigest() == expected, label + ' hash mismatch')


def inspect_matrix(receipt, receipt_path, root):
    results_path = receipt_path.parent / receipt.get('results', 'results.jsonl')
    runner_path = receipt_path.parent / receipt.get('runner', 'member2-resync-write-matrix.mjs')
    data, runner = read_inside(root, results_path), read_inside(root, runner_path)
    check_hash(data, receipt.get('results_sha256'), 'Results')
    check_hash(runner, receipt.get('runner_sha256'), 'Runner')
    lines = data.decode('utf-8').splitlines()
    require(len(lines) == 17, 'Matrix requires exactly 16 case records and one final summary')
    rows = [strict_json(line) for line in lines]
    require(all(isinstance(row, dict) for row in rows), 'Matrix records must be objects')
    require(rows[-1].get('event') == 'summary', 'Final matrix record must be its summary')
    expected_pairs = {(mode, name) for mode in MODES for name in SUPPORTED | {'edit-existing'}}
    observed = set()
    pending = controls = refusals = 0
    for row in rows[:-1]:
        require(row.get('event') == 'case', 'Unexpected non-case matrix record')
        pair = row.get('mode'), row.get('case')
        require(pair in expected_pairs and pair not in observed, 'Duplicate or unexpected matrix case')
        observed.add(pair)
        require(row.get('publicationVerified') is True, 'Case lacks verified publication')
        for field in ('warmReadError', 'coldReadError', 'warmAuditError', 'coldAuditError'):
            require(field in row and row[field] is None, 'Case has missing or failed ' + field)
        for field in ('warmProofs', 'coldProofs'):
            proof = row.get(field, {})
            require(proof.get('metadataProofMatches') is True and proof.get('invalidMessageIds') == [],
                    'Case has invalid ' + field)
        if row['case'] == 'edit-existing':
            error = row.get('commandError') or {}
            require(row.get('expectedUnsupported') is True and row.get('expectedRefusal') is True and
                    row.get('refusedWithoutBusinessChange') is True and
                    row.get('commandRecorded') is False and error.get('status') == 409 and
                    error.get('code') == 'current_room_context_unavailable', 'Edit refusal is not established')
            refusals += 1
        else:
            require(row.get('passed') is True and row.get('expectedUnsupported') is False and
                    row.get('commandRecorded') is True and row.get('retryDuplicate') is True and
                    'commandError' in row and row['commandError'] is None and
                    'retryError' in row and row['retryError'] is None and
                    row.get('erasedTextAbsent') is True, 'Supported case did not establish success')
            if row['mode'] == 'cold-while-pending':
                pending += 1
            else:
                controls += 1
    require(observed == expected_pairs, 'Missing matrix coverage')
    summary = {'event': 'summary', 'cases': 16, 'controlPassed': controls, 'controlTotal': 7,
               'pendingPassed': pending, 'pendingTotal': 7, 'expectedRefusals': refusals, 'refusalTotal': 2}
    require(rows[-1] == summary and receipt.get('summary') == summary, 'Summary disagrees with case records')
    return {'kind': 'matrix', 'cases': 16, 'pending_passed': pending, 'controls_passed': controls,
            'expected_refusals': refusals}


def inspect_native(receipt, receipt_path, root):
    data = read_inside(root, receipt_path.parent / receipt.get('log', 'full.log'))
    check_hash(data, receipt.get('log_sha256'), 'Native log')
    require(type(receipt.get('log_bytes')) is int and len(data) == receipt['log_bytes'], 'Native log size mismatch')
    require(receipt.get('outer_timeout') is False, 'Native run timed out or lacks timeout status')
    log = data.decode('utf-8')
    marker = 'PACKAGED_NATIVE_DURABLE_RESTORE '
    diagnostics = [line.split(marker, 1)[1] for line in log.splitlines() if marker in line]
    require(len(diagnostics) == 1, 'Need exactly one packaged Native diagnostic')
    result = strict_json(diagnostics[0])
    require(isinstance(result, dict), 'Native diagnostic must be an object')
    package = result.get('package', {})
    qualification = result.get('qualification', {})
    require(isinstance(package, dict) and isinstance(qualification, dict), 'Native package and qualification must be objects')
    require(result.get('sourceCommit') == receipt['runtime_sha'] and
            package.get('sourceCommit') == receipt['runtime_sha'], 'Native diagnostic source mismatch')
    require(package.get('verified') is True and result.get('archiveUnchanged') is True and
            result.get('productionSource') == 'verified offline archive', 'Unverified or modified runtime archive')
    require(re.fullmatch('[a-f0-9]{40}', package.get('sourceTree', '')) and
            re.fullmatch('[a-f0-9]{64}', package.get('manifestSha256', '')), 'Missing package source/manifest hashes')
    for field in ('actualNative', 'coldReady', 'exactRetry', 'acceptedNativeWorkCapacity', 'nativeWorkExactRetry'):
        require(qualification.get(field) is True, 'Native qualification missing ' + field)
    require(type(qualification.get('cleanupGuardCount')) is int and qualification['cleanupGuardCount'] == 0,
            'Native cleanup left guards or lacks a count')
    for label, count in [('tests', 1), ('pass', 1), ('fail', 0), ('cancelled', 0), ('skipped', 0)]:
        matches = re.findall(r'^(?:ℹ|#)\s+' + label + r'\s+(\d+)\s*$', log, re.MULTILINE)
        require(matches == [str(count)], 'Native terminal summary disagrees for ' + label)
    return {'kind': 'packaged_native', 'tests_passed': 1, 'source_tree': package['sourceTree'],
            'archive_manifest_sha256': package['manifestSha256'],
            'reported_whole_recovery_bounded': qualification.get('wholeRecoveryBounded'),
            'reported_final_unbounded_audit_required': qualification.get('finalUnboundedAuditRequired')}


def audit(root, receipt_path, checkout=None, git='git'):
    root = Path(os.path.abspath(root))
    receipt_path = Path(os.path.abspath(receipt_path))
    receipt = strict_json(read_inside(root, receipt_path).decode('utf-8'))
    require(isinstance(receipt, dict), 'Receipt must be a JSON object')
    require(re.fullmatch('[a-f0-9]{40}', receipt.get('runtime_sha', '')), 'Receipt needs an exact runtime SHA')
    require(type(receipt.get('exit_code')) is int and receipt['exit_code'] == 0, 'Receipt is not a successful terminal run')
    require(('runner_sha256' in receipt) != ('log_sha256' in receipt), 'Ambiguous or unsupported receipt format')
    if 'runner_sha256' in receipt:
        result = inspect_matrix(receipt, receipt_path, root)
    elif 'log_sha256' in receipt:
        result = inspect_native(receipt, receipt_path, root)
    else:
        raise ValueError('Unsupported qualification receipt format')
    result.update({'runtime_sha': receipt['runtime_sha'], 'artifact_consistency': True,
                   'checkout_checked': checkout is not None,
                   'scope': 'Receipt/artifact consistency, not authenticity, rerun, deployment or whole-release proof'})
    if checkout is not None:
        process = subprocess.run([git, '-C', str(checkout), 'rev-parse', 'HEAD', 'HEAD^{tree}'],
                                 capture_output=True, text=True, timeout=10)
        require(process.returncode == 0 and len(process.stdout.splitlines()) == 2, 'Cannot inspect source checkout')
        commit, tree = process.stdout.splitlines()
        require(commit == receipt['runtime_sha'], 'Source checkout revision differs from receipt')
        if result['kind'] == 'packaged_native':
            require(tree == result['source_tree'], 'Source checkout tree differs from package diagnostic')
        clean = subprocess.run([git, '-C', str(checkout), 'diff', '--no-ext-diff', '--quiet', 'HEAD', '--'],
                               capture_output=True, timeout=10)
        require(clean.returncode == 0, 'Source checkout has tracked changes or cannot be checked')
        result['checkout_tracked_clean'] = True
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence_root', type=Path)
    parser.add_argument('receipt', type=Path)
    parser.add_argument('--source-checkout', type=Path)
    parser.add_argument('--git', default='git', help='Git executable, only used for optional read-only source checks')
    args = parser.parse_args()
    try:
        result = audit(args.evidence_root, args.receipt, args.source_checkout, args.git)
    except (ValueError, OSError, TypeError, KeyError, subprocess.SubprocessError) as error:
        print(json.dumps({'artifact_consistency': False, 'error': str(error)}))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
