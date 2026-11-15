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
rows('Deployment options we considered',[
 ['[Deployment option 1]','[Benefits for our team]\n[Limitations or tradeoffs]'],
 ['[Deployment option 2]','[Benefits for our team]\n[Limitations or tradeoffs]'],
 ['How we compared the options','[Criteria: device access, setup, distribution, or testing needs]']
],'List the options the team actually evaluated. Add another option if needed.');
rows('Why we chose TestFlight',[
 ['Our choice: TestFlight','[Why TestFlight fit our team and milestone timeline]'],
 ['Mobile user testing','TestFlight let us put Divvy on phones for user testing.\n[What this enabled us to test]'],
 ['What deployment involved','[Build and release steps]\n[Main challenge and how we handled it]']
]);
let s=blank('Try Divvy on your phone');text(s,'TestFlight download',60,135,480,40,24,'#1F6E52',true);text(s,'[Add the public TestFlight invitation URL]',60,190,475,80);text(s,'[Add brief installation steps and any\nrequirements for your testers]',60,290,475,100);text(s,'[Add where testers should send feedback]',60,440,800,40,18,'#66756C');text(s,'[Insert TestFlight\nQR code here]',610,150,250,250,24,'#66756C',false,'#FFFFFF');s.speakerNotes.text='Presenter: [name]\nReplace the QR placeholder with a code for the actual invitation URL. Test the code on a phone before presenting.';
rows('User testing on mobile',[
 ['Testing through TestFlight','[Who tested]  [Number of testers]  [Devices and testing period]'],
 ['Tasks we asked users to complete','[Task 1]  [Task 2]\n[What you observed on a real phone]'],
 ['What we learned','[Most useful feedback or finding]\n[How it shaped a fix or a next step]']
]);
function compare(title){let s=blank(title);text(s,'Before',60,124,250,35,24,'#66756C',true);text(s,'After',350,124,250,35,24,'#1F6E52',true);text(s,'[Before\nscreenshot]',60,169,240,255,20,'#66756C',false,'#FFFFFF');text(s,'[After\nscreenshot]',350,169,240,255,20,'#66756C',false,'#FFFFFF');text(s,'What changed',630,148,270,38,24,'#1F6E52',true);text(s,'[Describe the fix]',630,195,270,65);text(s,'Why it mattered',630,282,270,38,24,'#1F6E52',true);text(s,'[Impact on the user]',630,329,270,80);text(s,'[How we verified the improvement]',60,460,825,40,20);s.speakerNotes.text='Presenter: [name]\nName the affected flow and explain the original problem. Use comparable screenshots. Add the result of retesting. Duplicate this slide for additional examples.';}
for(let i=1;i<=3;i++) compare(`Bug fix ${i}: [issue or affected flow]`);
for(let i=1;i<=3;i++) compare(`UI improvement ${i}: [screen or flow]`);
rows('Plaid: benefits and limitations',[
 ['What worked in the existing integration','Plaid Link, token exchange, cursor sync, and disconnect.\n[Which capabilities helped Divvy most]'],
 ['The paid-tier discussion','We considered keeping Plaid and moving to a paid tier.'],
 ['Our cost concern','The transaction pricing was not clear enough to our team.\nWe chose Teller’s development plan instead.']
],'Source: team-provided M5 migration notes. The cost concern describes the team’s assessment, not a verified current pricing claim.');
rows('Bank connection options',[
 ['Stay with Plaid on a paid tier','Keep the existing integration.\nOur team could not clearly determine transaction costs.'],
 ['Switch to Teller’s development plan','Our selected approach. It requires migration work\nand developer-account approval.'],
 ['[Other options considered]','[Option and tradeoff, or remove this section]']
],'Source: team-provided M5 migration notes. Add any other options the team actually considered.');
rows('Teller decision and milestone status',[
 ['Our decision: Teller’s development plan','We chose Teller after discussing a paid Plaid tier.'],
 ['Developer-account approval takes time','Teller requires developer registration and approval.\nThat timing kept us from shipping the switch for M5.'],
 ['Next milestone','[Current approval status]  [Owner]\n[Migration target and remaining validation]']
],'Source: team-provided M5 migration notes. The switch did not ship for this milestone. Confirm the latest approval status before presenting.');
rows('Migration: server and connection flow',[
 ['Server-bank module','Replace Plaid Link, token exchange, cursor sync,\nand disconnect logic with Teller calls.'],
 ['ConnectedAccounts module','Replace Plaid Link with Teller’s Connect widget.'],
 ['Transaction fetching','Our migration plan replaces Plaid’s cursor-based sync\nwith explicit transaction fetching for Teller.']
],'Source: team-provided M5 migration notes. Team assessment: Teller has no cursor-based syncing as in Plaid, so transactions must be fetched manually. Describe the planned fetch trigger and duplicate-handling approach. These are required changes, not claims of completed work.');
rows('Migration: categories and database',[
 ['Budget mapping and reconciliation','Teller’s transaction categories differ from Plaid’s.\nUpdate category mapping and reconciliation logic.'],
 ['Database fields and indexes','Rename Plaid-specific fields and indexes\nto reflect the Teller integration.'],
 ['Migration validation','[Tests for transaction imports and category mapping]\n[Data migration checks and remaining work]']
],'Source: team-provided M5 migration notes. These are required changes. Fill in implementation and validation status before presenting.');
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
console.log(await finalizePresentation({workspaceDir:root,candidatePath:`${root}/.m5-build/draft.pptx`,finalPath:`${root}/output/Divvy-M5-Fill-In-v2.pptx`,pythonExecutable:'/Users/eva/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:`${skill}/container_tools/inspect_presentation_package_integrity.py`,layoutValidatorPath:`${skill}/container_tools/inspect_presentation_layout_geometry.py`,layoutArgs:['--expected-slide-size-emu','9144000,5143500','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Helvetica Neue'],referencePath:source,referenceSha256:crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex')},verifyArtifactToolImport:true,receiptPath:`${root}/.m5-build/validation-v2.json`}));
