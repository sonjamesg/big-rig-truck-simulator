// ===== v2 hand-authored overrides: organic patchwork cities, re-routed freeways, new interchanges =====
// district: [name, seedX, seedY, angle(rad), blockW, blockH, kind]  kind: down | mid | ind | sub
const CITIES=[
 {name:'PORT ALBION', c:[290,330], R:265, st:[1.0,1.0], ph:[0.4,1.9,2.7],
  d:[['Downtown',265,255,0.06,13,11,'down'],['Old Harbour',395,175,0.44,11,14,'down'],['Quayside',430,340,0.30,26,18,'ind'],
     ['Westgate',150,300,-0.27,17,15,'mid'],['Northcliff',205,120,0.18,0,0,'sub'],['Kings Cross',320,445,-0.13,15,19,'mid'],
     ['Bayview',135,470,0.62,0,0,'sub'],['Southmead',450,560,-0.32,0,0,'sub'],['Rigsby',300,330,-0.55,12,16,'mid']],
  art:[['Albion Boulevard',[[95,560],[180,450],[245,350],[310,250],[400,150],[480,90]],'blvd'],
       ['Crescent Avenue',[[70,340],[180,350],[290,318],[400,335],[470,310],[560,270]]],
       ['Northcliff Drive',[[150,85],[225,160],[255,265],[245,420],[300,560],[340,610]]],
       ['Westcliff Esplanade',[[160,70],[90,140],[72,300],[80,470],[110,600]],'coast'],
       ['Harbour Road',[[300,70],[420,100],[470,190],[468,330],[480,440],[560,560]],'coast']],
  parks:[['Albion Park',225,215,30,22,0.2],['Cliff Gardens',120,390,16,26,0.5]], stadium:[360,400,-0.13,'Albion Stadium']},
 {name:'SANDVALE', c:[1710,370], R:270, st:[0.98,1.0], ph:[1.1,0.3,2.2],
  d:[['Downtown',1610,250,-0.10,12,12,'down'],['The Strip',1505,390,0.0,12,27,'mid'],['Mesa Heights',1770,340,0.36,0,0,'sub'],
     ['Old Mission',1720,165,-0.46,14,14,'mid'],['East Industrial',1860,560,0.12,30,22,'ind'],['Canyon View',1890,250,-0.2,0,0,'sub'],
     ['Southgate',1640,520,0.26,16,16,'mid'],['Palm Flats',1525,610,0.5,0,0,'sub']],
  art:[['Sandvale Parkway',[[1470,640],[1560,480],[1650,330],[1760,190],[1880,80]],'blvd'],
       ['Mission Boulevard',[[1460,240],[1600,235],[1760,275],[1960,235]]],
       ['Mesa Drive',[[1570,80],[1635,250],[1720,420],[1700,650]]],
       ['Eastshore Drive',[[1890,70],[1958,180],[1962,350],[1950,520]],'coast']],
  parks:[['Mission Park',1690,250,22,18,-0.46],['Mesa Reserve',1820,410,30,20,0.36]], stadium:[1560,320,0,'Sandvale Bowl']},
 {name:'KINGSBRIDGE', c:[1610,1590], R:275, st:[1.05,0.88], ph:[2.0,0.7,1.4],
  d:[['City Centre',1545,1500,0.0,12,12,'down'],['Old Town',1430,1610,-0.42,10,10,'down'],['Cathedral Quarter',1660,1560,0.28,14,12,'down'],
     ['Harbourside',1630,1785,0.05,28,18,'ind'],['Riverside',1395,1470,0.6,16,16,'mid'],['Hillcrest',1730,1410,-0.3,0,0,'sub'],
     ['Eastbrook',1810,1640,-0.16,17,15,'mid'],['Southwick',1360,1360,0.2,0,0,'sub'],['Fenside',1850,1480,0.4,0,0,'sub']],
  art:[['Kingsbridge Way',[[1320,1730],[1430,1640],[1545,1530],[1665,1420],[1800,1350]],'blvd'],
       ['Cathedral Road',[[1350,1525],[1500,1565],[1655,1600],[1820,1580],[1925,1520]]],
       ['North Road',[[1555,1350],[1570,1500],[1600,1650],[1620,1810]]],
       ['Harbour Boulevard',[[1380,1805],[1500,1812],[1640,1806],[1800,1812],[1900,1790]],'coast']],
  parks:[['Kings Park',1600,1450,26,20,0.1],['Abbey Green',1480,1580,12,16,-0.42]], stadium:[1760,1530,-0.16,'Kingsbridge Arena']},
];
// freeway re-routes: slice through / wrap the cities
function v2patch(L){
  const f=n=>L.fwy.find(x=>x.name===n);
  f('M5').pts=[[470,110],[405,190],[372,300],[392,420],[470,470]];
  const m1=f('M1').pts; const i=m1.findIndex(p=>p[0]===1500&&p[1]===548); m1.splice(i,3,[1515,500],[1640,440],[1790,452],[1890,540]);
  f('M3').pts=[[1000,520],[960,610],[905,720],[884,860],[900,1062],[912,1250],[930,1400],[985,1520],[1070,1625],[1210,1650],[1340,1640],[1470,1680],[1620,1690],[1780,1700],[1944,1700]];
  const J=(id,k,x,y,n)=>{ const j=L.inter.find(q=>q[0]===id); j[1]=k; j[2]=x; j[3]=y; if(n) j[4]=n; };
  J('J1','tee',108,980); J('J2','tee',470,110); J('J4','diamond',375,300); J('J8','stack',900,1062); J('J11','tee',1946,760); J('J16','tee',1944,1700);
  J('J13','cloverleaf',1640,442,'Sandvale South'); J('J15','cloverleaf',1580,1688,'Kingsbridge Central'); J('J17','diamond',1340,1640);
  L.inter.push(['J21','diamond',1790,452,'Sandvale East'],['J22','terminal',1000,520,'M3 North / A3 Dustwater']);
  const ap=L.landmarks.find(l=>l.name==='Albion Airport'); ap.poly=[[150,632],[440,632],[440,790],[150,790]]; ap.rw=[[175,660,420,672],[195,748,425,760]]; ap.term=[262,690,342,722];
  L.grids=L.grids.filter(g=>g.kind==='town');
  L.labels=L.labels.filter(l=>l[3]!=='dist'&&l[3]!=='city'); const al=L.labels.find(l=>l[0]==='Albion Airport'); al[1]=295; al[2]=712;
  for(const l of L.labels) if(l[0]==='Millford') l[2]=870;
}
