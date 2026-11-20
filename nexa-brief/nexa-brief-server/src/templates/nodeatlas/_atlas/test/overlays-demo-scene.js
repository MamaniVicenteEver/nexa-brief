export const scene={layers:[
 {type:'dot',at:[-65,20],t:0},{type:'ring',at:[-45,0],t:0},
 {type:'pole-photo',at:[-45,0],src:'portrait',label:'Headquarter',sub:'North America'},
 {type:'tag',at:[0,30],text:'Research'},
 {type:'hex-photo',at:[5,-25],src:'supplier',title:'Supplier',text:'A network connects resources across the continent.',fillAt:.8},
 {type:'panel',at:[75,25],src:'train',title:'Distributor',text:'A route connects the region to the wider world.',blankFor:.7,anchor:'left'},
 {type:'bars',at:[65,-32],text:'Warehouse'},
 {type:'arc',from:[-65,20],to:[-45,0],dur:2,keep:true,style:'cyan'},
 {type:'arc',from:[-45,0],to:[0,30],dur:2,keep:true,style:'magenta',lift:210},
 {type:'title',text:'A connected world',sub:'Atlas overlays',y:.08,size:48}
]};
