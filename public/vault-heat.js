// One stable activity palette shared by all four content networks.
export const VAULT_HEAT_LEVELS=[
  {name:'White',color:'#eeeeee',label:'Single use',turns:0},
  {name:'Pale green',color:'#b8e7bd',label:'2 substantive turns',turns:2},
  {name:'Green',color:'#63cf8b',label:'3 substantive turns',turns:3},
  {name:'Teal',color:'#44d3bf',label:'4 turns or 3 conversations',turns:4,sessions:3},
  {name:'Blue',color:'#61a7f5',label:'5 substantive turns',turns:5},
  {name:'Indigo',color:'#7586ec',label:'6 turns or 4 conversations',turns:6,sessions:4},
  {name:'Purple',color:'#b18af2',label:'3 turns across 2 days',turns:3,days:2},
  {name:'Orchid',color:'#cc79dc',label:'5 turns across 2 days',turns:5,days:2},
  {name:'Pink',color:'#e77bb2',label:'5 turns across 3 days',turns:5,days:3},
  {name:'Coral',color:'#ee8585',label:'6 turns across 3 days',turns:6,days:3},
  {name:'Orange',color:'#f5a451',label:'8 turns across 3 days',turns:8,days:3},
  {name:'Amber',color:'#e9c754',label:'12 turns across 4 days',turns:12,days:4},
  {name:'Gold',color:'#f3ce60',label:'16 turns across 5 days or designated priority',turns:16,days:5},
];
export function vaultActivityHeat(heat={}){
  const turns=Number(heat.userTurns)||0,days=Number(heat.activeDays)||0,sessions=Number(heat.sourceConversations)||0;
  let level=0;for(let i=1;i<VAULT_HEAT_LEVELS.length;i++){const rule=VAULT_HEAT_LEVELS[i];if((!rule.days||days>=rule.days)&&((rule.turns!==undefined&&turns>=rule.turns)||(rule.sessions!==undefined&&sessions>=rule.sessions)))level=i;}
  if(heat.basis==='user-project')level=12;
  return {...heat,level,...VAULT_HEAT_LEVELS[level]};
}
// Keep the original Vault exports compatible with existing integrations.
export const NETWORK_HEAT_LEVELS=VAULT_HEAT_LEVELS;
export const networkActivityHeat=vaultActivityHeat;
