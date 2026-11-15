from pathlib import Path
p=Path('.m5-build/build.mjs').read_text()
a=p.index("rows('Deployment: why TestFlight'")
b=p.index("let s=blank",a)
p=p[:a]+'''rows('Deployment options we considered',[
 ['[Deployment option 1]','[Benefits for our team]\\n[Limitations or tradeoffs]'],
 ['[Deployment option 2]','[Benefits for our team]\\n[Limitations or tradeoffs]'],
 ['How we compared the options','[Criteria: device access, setup, distribution, or testing needs]']
],'List the options the team actually evaluated. Add another option if needed.');
rows('Why we chose TestFlight',[
 ['Our choice: TestFlight','[Why TestFlight fit our team and milestone timeline]'],
 ['Mobile user testing','TestFlight let us put Divvy on phones for user testing.\\n[What this enabled us to test]'],
 ['What deployment involved','[Build and release steps]\\n[Main challenge and how we handled it]']
]);
'''+p[b:]
a=p.index("compare('Bug fix:")
b=p.index("rows('Database usage limits'",a)
p=p[:a]+'''for(let i=1;i<=3;i++) compare(`Bug fix ${i}: [issue or affected flow]`);
for(let i=1;i<=3;i++) compare(`UI improvement ${i}: [screen or flow]`);
rows('Plaid: benefits and limitations',[
 ['What worked in the existing integration','Plaid Link, token exchange, cursor sync, and disconnect.\\n[Which capabilities helped Divvy most]'],
 ['The paid-tier discussion','We considered keeping Plaid and moving to a paid tier.'],
 ['Our cost concern','The transaction pricing was not clear enough to our team.\\nWe chose Teller’s development plan instead.']
],'Source: team-provided M5 migration notes. The cost concern describes the team’s assessment, not a verified current pricing claim.');
rows('Bank connection options',[
 ['Stay with Plaid on a paid tier','Keep the existing integration.\\nOur team could not clearly determine transaction costs.'],
 ['Switch to Teller’s development plan','Our selected approach. It requires migration work\\nand developer-account approval.'],
 ['[Other options considered]','[Option and tradeoff, or remove this section]']
],'Source: team-provided M5 migration notes. Add any other options the team actually considered.');
rows('Teller decision and milestone status',[
 ['Our decision: Teller’s development plan','We chose Teller after discussing a paid Plaid tier.'],
 ['Developer-account approval takes time','Teller requires developer registration and approval.\\nThat timing kept us from shipping the switch for M5.'],
 ['Next milestone','[Current approval status]  [Owner]\\n[Migration target and remaining validation]']
],'Source: team-provided M5 migration notes. The switch did not ship for this milestone. Confirm the latest approval status before presenting.');
rows('Migration: server and connection flow',[
 ['Server-bank module','Replace Plaid Link, token exchange, cursor sync,\\nand disconnect logic with Teller calls.'],
 ['ConnectedAccounts module','Replace Plaid Link with Teller’s Connect widget.'],
 ['Transaction fetching','Our migration plan replaces Plaid’s cursor-based sync\\nwith explicit transaction fetching for Teller.']
],'Source: team-provided M5 migration notes. Team assessment: Teller has no cursor-based syncing as in Plaid, so transactions must be fetched manually. Describe the planned fetch trigger and duplicate-handling approach. These are required changes, not claims of completed work.');
rows('Migration: categories and database',[
 ['Budget mapping and reconciliation','Teller’s transaction categories differ from Plaid’s.\\nUpdate category mapping and reconciliation logic.'],
 ['Database fields and indexes','Rename Plaid-specific fields and indexes\\nto reflect the Teller integration.'],
 ['Migration validation','[Tests for transaction imports and category mapping]\\n[Data migration checks and remaining work]']
],'Source: team-provided M5 migration notes. These are required changes. Fill in implementation and validation status before presenting.');
'''+p[b:]
p=p.replace('Divvy-M5-Fill-In.pptx','Divvy-M5-Fill-In-v2.pptx').replace('/validation.json','/validation-v2.json')
Path('.m5-build/build-v2.mjs').write_text(p)
