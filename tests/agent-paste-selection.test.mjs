import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,cpSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {agentPages,PASTE_PAGE} from '../scripts/build-agent-docs.mjs';
const decode=s=>s.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
test('paste prompt is exact readonly labeled native selection field; other docs retain code blocks',()=>{
 const actual=readFileSync(new URL('../docs/agents/paste.md',import.meta.url),'utf8').match(/```text\n([\s\S]*?)\n```/)[1];
 const generated=agentPages().get(PASTE_PAGE.htmlFile).match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/)[1];assert.equal(decode(generated),actual);
 const dir=mkdtempSync(join(tmpdir(),'paste-selection-'));
 try{
 cpSync(new URL('../docs/agents/',import.meta.url),dir,{recursive:true});
 const file=join(dir,'paste.md'),original=readFileSync(file,'utf8');
 const prompt='Exact <tag> & "quoted" prompt\n\n</textarea><script>not executable</script>\nFinal line';
 writeFileSync(file,original.replace(/```text\n[\s\S]*?\n```/,'```text\n'+prompt+'\n```'));
 const pages=agentPages(dir),html=pages.get(PASTE_PAGE.htmlFile),field=/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/.exec(html);assert.ok(field);assert.match(field[1],/readonly/);assert.match(field[1],/rows="16"/);assert.match(field[1],/id="agent-paste-prompt"/);assert.match(html,/<label for="agent-paste-prompt">Copy this prompt into your agent<\/label>/);assert.equal(decode(field[2]),prompt);assert.doesNotMatch(html,/<script>not executable/);assert.equal((html.match(/<textarea\b/g)||[]).length,1);assert.doesNotMatch(html,/<pre\b/);
 for(const [name,page] of pages)if(name!==PASTE_PAGE.htmlFile){assert.doesNotMatch(page,/<textarea\b/);if(name!=='docs/agents/index.html')assert.match(page,/<pre tabindex="0"/);}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
