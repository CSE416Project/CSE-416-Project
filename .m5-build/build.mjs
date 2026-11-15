import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {PresentationFile,FileBlob} from '@oai/artifact-tool';
import {finalizePresentation} from '/Users/eva/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root='/Users/eva/Desktop/CSE-416-Project', skill='/Users/eva/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations';
const source='/Users/eva/Downloads/m2 pres.pptx';
const p=await PresentationFile.importPptx(await FileBlob.load(source));
const cover=p.slides.items[0].copy(), base=p.slides.items[2].copy();
const start=p.slides.items.length;
const c=p.slides.addCopy(cover);c.shapes.items.find(s=>s.text.toString()==='Milestone 2').text='Milestone 5';c.speakerNotes.text='Presenter: [name]\nOpening: [one sentence about progress since the last milestone]';
function text(s,t,x,y,w,h,size=20,color='#1A2421',bold=false,fill='none') {const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill,line:{fill:fill==='none'?'none':'#C7E5D1',width:fill==='none'?0:1}});a.text=t;a.text.style={typeface:'Helvetica Neue',fontSize:size,color,bold};return a;}
function blank(title){const s=p.slides.addCopy(base);s.shapes.items.forEach(x=>x.text='');text(s,title,60,42,840,70,36,'#1A2421',true);s.speakerNotes.text='Presenter: [name]\n[Add your talking points and supporting evidence.]';return s;}
function rows(title,parts,notes=''){const s=p.slides.addCopy(base);let shapes=s.shapes.items;const vals=[title,...parts.flat()];shapes.forEach((a,i)=>{a.text=vals[i]||'';a.text.style={typeface:'Helvetica Neue',fontSize:i===0?36:i%2===1?24:20,bold:i===0||i%2===1,color:i%2===1?'#1F6E52':'#1A2421'};});s.speakerNotes.text='Presenter: [name]\n'+notes;return s;}
rows('Deployment: why TestFlight',[
 ['Options we considered','[Option 1 and tradeoff]   /   [Option 2 and tradeoff]'],
 ['Our choice: TestFlight','[Why TestFlight fit our team, timeline, and testing needs]'],
 ['What deployment involved','[Build and release steps]  [Main challenge and how we handled it]']
],'List only options the team actually evaluated. Explain the deciding factor.');
let s=blank('Try Divvy on your phone');text(s,'TestFlight download',60,135,480,40,24,'#1F6E52',true);text(s,'[Add the public TestFlight invitation URL]',60,190,475,80);text(s,'[Add brief installation steps and any\nrequirements for your testers]',60,290,475,100);text(s,'[Add where testers should send feedback]',60,440,800,40,18,'#66756C');text(s,'[Insert TestFlight\nQR code here]',610,150,250,250,24,'#66756C',false,'#FFFFFF');s.speakerNotes.text='Presenter: [name]\nReplace the QR placeholder with a code for the actual invitation URL. Test the code on a phone before presenting.';
rows('User testing on mobile',[
 ['Testing through TestFlight','[Who tested]  [Number of testers]  [Devices and testing period]'],
 ['Tasks we asked users to complete','[Task 1]  [Task 2]\n[What you observed on a real phone]'],
 ['What we learned','[Most useful feedback or finding]\n[How it shaped a fix or a next step]']
]);
function compare(title){let s=blank(title);text(s,'Before',60,124,250,35,24,'#66756C',true);text(s,'After',350,124,250,35,24,'#1F6E52',true);text(s,'[Before\nscreenshot]',60,169,240,255,20,'#66756C',false,'#FFFFFF');text(s,'[After\nscreenshot]',350,169,240,255,20,'#66756C',false,'#FFFFFF');text(s,'What changed',630,148,270,38,24,'#1F6E52',true);text(s,'[Describe the fix]',630,195,270,65);text(s,'Why it mattered',630,282,270,38,24,'#1F6E52',true);text(s,'[Impact on the user]',630,329,270,80);text(s,'[How we verified the improvement]',60,460,825,40,20);s.speakerNotes.text='Presenter: [name]\nName the affected flow and explain the original problem. Use comparable screenshots. Add the result of retesting. Duplicate this slide for additional examples.';}
compare('Bug fix: [issue or affected flow]');compare('UI improvement: [screen or flow]');
rows('Rewriting bank connections',[
 ['Why the backend needed to change','[What the previous implementation could not support]\n[How that affected users or development]'],
 ['What we rewrote','[Endpoints, provider integration, or sync behavior changed]'],
 ['What the rewrite enables','[Benefit demonstrated so far]\n[Remaining work or limitation]']
]);
rows('Plaid: benefits and limitations',[
 ['Benefits for Divvy','[Useful capabilities we tested]\n[What Plaid simplified for our app]'],
 ['Limitations we encountered','[Access, coverage, cost, or testing constraint]\n[Concrete impact on our implementation]'],
 ['What this meant for our decision','[The tradeoff that mattered most to the team]']
],'Add sources and dates for any provider pricing or access claims. Separate observed limitations from assumptions.');
s=blank('Bank connection options');
const cols=[60,285,510,735];['Option','Benefits','Limitations','Decision'].forEach((t,i)=>text(s,t,cols[i],135,i===3?170:205,35,22,'#1F6E52',true));
[['Paid Plaid','[Benefit]','[Cost / access]','[Reason]'],['Teller','[Benefit]','[Constraint]','[Reason]'],['[Other option]','[Benefit]','[Constraint]','[Reason]']].forEach((row,r)=>row.forEach((t,i)=>text(s,t,cols[i],200+r*90,i===3?170:205,75,20)));
text(s,'[Add other options considered and the criteria used to compare them]',60,475,840,40,18,'#66756C');s.speakerNotes.text='Presenter: [name]\nUse verified pricing and access terms. Include all options the team actually considered. Explain why each option stayed in or dropped out.';
rows('Our bank connection decision',[
 ['We chose [provider or approach]','[The main reason for this choice]'],
 ['How it fits Divvy','[What changed in the backend]\n[What users can do with the current implementation]'],
 ['Tradeoffs and remaining work','[Limitation we accepted]\n[What we still need to validate]']
]);
rows('Database usage limits',[
 ['We reach our usage limit quickly','[Database service and plan]  [Limit and reset period]\n[Observed usage and how quickly we reach the limit]'],
 ['Where the usage comes from','[Queries or flows responsible]  [Evidence from logs or metrics]'],
 ['Impact on Divvy','[What happens when the limit is reached]\n[Effect on testing or the user experience]']
]);
rows('Caching and the plan before M6',[
 ['Caching: [current or planned]','[What we cache and where]\n[How cached data refreshes after changes]'],
 ['Other usage reductions','[Queries, polling, or repeated requests to reduce]\n[Owner and target date]'],
 ['How we will check improvement','[Usage baseline]  [Target reduction]  [Test workload]\n[What must be complete before M6]']
],'Clarify what already exists and what is proposed. Explain how you will keep balances and transactions accurate while reducing database requests.');
rows('The future',[
 ['Before M6','[Highest priority]  [Owner]  [Target date]\n[What completion looks like]'],
 ['Next product improvements','[Feature or user experience to improve]\n[Why it matters and how you will validate it]'],
 ['Beyond M6','[Longer-term direction]\n[Open question or feedback you want from the audience]']
]);
p.slides.keep(Array.from({length:p.slides.items.length-start},(_,i)=>start+i));
for(let i=0;i<p.slides.items.length;i++) await fs.writeFile(`${root}/.m5-build/final-${i+1}.png`,new Uint8Array(await (await p.export({slide:p.slides.items[i],format:'png',scale:1})).arrayBuffer()));
await fs.writeFile(`${root}/.m5-build/final.webp`,new Uint8Array(await (await p.export({format:'webp',montage:true})).arrayBuffer()));
await (await PresentationFile.exportPptx(p)).save(`${root}/.m5-build/draft.pptx`);
console.log(await finalizePresentation({workspaceDir:root,candidatePath:`${root}/.m5-build/draft.pptx`,finalPath:`${root}/output/Divvy-M5-Fill-In.pptx`,pythonExecutable:'/Users/eva/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:`${skill}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${skill}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu','9144000,5143500','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Helvetica Neue'],referencePath:source,referenceSha256:crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex')},verifyArtifactToolImport:true,receiptPath:`${root}/.m5-build/validation.json`}));
