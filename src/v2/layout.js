// ===================== BIG RIG — curvy-world MAP DESIGN (hand-authored control points, tiles; 1 tile = 4 m) =====================
// Terrain (coasts, sounds, rivers, desert, mountains) comes from the current game so the islands stay familiar.
const L={cities:[],grids:[],blocks:[],fwy:[],roads:[],rail:[],poi:[],labels:[],inter:[],bridges:[],landmarks:[]};
// ---- downtown grid helper: origin, angle, column/row offsets (irregular = SA-style varied blocks), landmark blocks by [i,j]
function GRD(name,ox,oy,ang,xs,ys,o){ o=o||{}; L.grids.push({name,ox,oy,ang,xs,ys,kind:o.kind||'city',land:o.land||{},skip:o.skip||[],cut:o.cut||null}); }
// ---------------- PORT ALBION (NW) ----------------
GRD('Albion Downtown',192,168,0,[0,17,33,50,64,80,97,113,128,146],[0,15,32,47,63,80,95,111,128,144,160],{land:{'2,3':'park','3,3':'park','6,6':'stadium','1,1':'hq','0,6':'hospital','4,8':'mall','7,1':'civic','8,4':'plaza'}});
GRD('Quayside',372,186,0.33,[0,18,34,52,70],[0,16,30,46,64,80,98,116],{kind:'ind',land:{'1,3':'depot','2,6':'super'}});
GRD('Westgate',178,352,-0.22,[0,16,34,50,68,86,104],[0,16,30,46,62,78],{kind:'res',land:{'2,2':'park','4,3':'fuel'}});
L.landmarks.push({kind:'docks',name:'Albion Docks',poly:[[474,145],[720,145],[720,455],[474,455]]});
L.landmarks.push({kind:'airport',name:'Albion Airport',poly:[[165,478],[640,478],[640,655],[165,655]],rw:[[190,500,590,512],[230,606,600,618]],term:[300,540,380,560]});
// ---------------- SANDVALE (NE) ----------------
GRD('Sandvale Downtown',1478,182,0,[0,16,31,48,62,79,95,110,128,144,160],[0,17,33,48,66,82,98,115,132],{land:{'3,2':'park','4,2':'park','7,5':'stadium','1,6':'mall','8,1':'civic','5,4':'plaza','9,7':'hospital'}});
GRD('Mesa Heights',1640,352,0.3,[0,16,32,48,64,82],[0,16,32,48,64],{kind:'res',land:{'1,1':'park','3,2':'super'}});
GRD('Sandvale East Industrial',1742,520,0,[0,22,44,66,88],[0,20,40],{kind:'ind',land:{'1,0':'depot','2,1':'dealer'}});
L.landmarks.push({kind:'airport',name:'Sandvale International',poly:[[1072,162],[1442,162],[1442,338],[1072,338]],rw:[[1092,184,1420,196],[1092,300,1420,312]],term:[1180,226,1300,250]});
// ---------------- KINGSBRIDGE (SE) ----------------
GRD('Kingsbridge Centre',1452,1446,0,[0,15,30,47,62,78,95,110,126,142,158,174,190],[0,16,31,46,62,78,94,110,126,142],{land:{'4,3':'park','5,3':'park','9,6':'stadium','2,1':'mall','10,2':'civic','6,7':'plaza','1,8':'hospital'}});
GRD('Old Town',1418,1612,-0.4,[0,14,28,42,56,70],[0,13,26,39,52,65],{kind:'res',land:{'2,2':'park','3,4':'super'}});
GRD('Harbourside',1500,1772,0.12,[0,24,48,72,96,120,144,168,192],[0,22,44],{kind:'ind',land:{'2,1':'depot','5,1':'depot2','7,0':'dealer'}});
L.landmarks.push({kind:'docks',name:'Kingsbridge Harbour',poly:[[1404,1820],[1800,1820],[1800,1884],[1404,1884]]});
L.landmarks.push({kind:'airport',name:'Kingsbridge Field',poly:[[1198,1794],[1384,1794],[1384,1902],[1198,1902]],rw:[[1210,1858,1378,1868]],term:[1214,1810,1260,1824]});
// ---------------- towns: compact clusters ----------------
const TOWN=(n,x,y,a,cols,rows,land)=>GRD(n,x,y,a,cols,rows,{kind:'town',land});
TOWN('Millford',272,810,0.1,[0,14,28,42,56],[0,13,26,40,54],{'1,1':'park','2,2':'fuel','3,1':'depot'});
TOWN('Dustwater',1012,432,-0.15,[0,14,28,42,56],[0,14,28,42,56],{'2,1':'fuel','1,3':'depot'});
TOWN('Coppermine',1604,612,0.2,[0,14,28,42],[0,14,28,42],{'1,1':'depot','2,2':'garage'});
TOWN('Redhill',1000,1180,0,[0,13,26,40,54,68],[0,14,28,42,56],{'2,2':'park','3,1':'fuel','1,3':'depot','4,3':'super'});
TOWN('Fenwick',1512,1132,-0.3,[0,14,28,42,56],[0,14,28,42],{'1,1':'depot','3,2':'garage'});
TOWN('Ashby',246,1108,0.25,[0,12,24,36],[0,12,24,36],{'1,1':'depot','2,2':'fuel'});
TOWN('Wendwood',492,890,0,[0,12,24,36],[0,12,24],{'1,0':'church'});
// ---------------- freeways (smooth, wrap the coasts, slice between districts) ----------------
L.fwy.push({name:'M1',pts:[[110,1860],[96,1500],[104,1100],[108,980],[110,760],[128,600],[132,470],[128,330],[140,200],[190,118],[360,104],[470,110],[700,96],[920,108],[1150,112],[1380,110],[1452,150],[1456,300],[1460,450],[1500,548],[1640,566],[1800,580],[1930,640],[1946,760],[1940,1100],[1930,1420],[1944,1700],[1920,1880],[1800,1944],[1500,1950],[1200,1946],[920,1948],[700,1940],[400,1946],[180,1930],[110,1860]],closed:true});
L.fwy.push({name:'M2',pts:[[108,980],[300,1000],[520,1030],[700,1046],[900,1062],[1080,1050],[1240,1000],[1272,900],[1290,800],[1380,720],[1600,698],[1800,700],[1946,760]]});
L.fwy.push({name:'M3',pts:[[900,1062],[912,1250],[930,1400],[1040,1530],[1200,1600],[1350,1660],[1450,1745],[1640,1752],[1820,1745],[1944,1700]]});
L.fwy.push({name:'M5',sub:'Albion Expressway',pts:[[470,110],[462,200],[458,300],[462,400],[470,470]]});
// interchanges (on freeway nearest point): kind cloverleaf | diamond | stack | trumpet
L.inter.push(['J1','stack',108,980,'M1/M2 Westmere'],['J2','trumpet',470,110,'M1/M5 Albion North'],['J3','cloverleaf',470,470,'Airport Road'],['J4','diamond',462,300,'Docks'],['J5','diamond',128,330,'Albion West'],
  ['J6','diamond',300,1000,'Millford'],['J7','diamond',104,1120,'Ashby'],['J8','stack',900,1062,'M2/M3 Moor Cross'],['J9','diamond',1080,1050,'Redhill'],['J10','diamond',1600,698,'Coppermine'],['J11','stack',1946,760,'M1/M2 East'],
  ['J12','cloverleaf',1456,300,'Sandvale Airport'],['J13','cloverleaf',1640,566,'Sandvale South'],['J14','diamond',1020,110,'Dustwater North'],['J15','cloverleaf',1450,1745,'Kingsbridge Harbour'],['J16','stack',1944,1700,'M1/M3 Kingsbridge'],
  ['J17','diamond',1350,1660,'Kingsbridge West'],['J18','diamond',1940,1300,'Fenwick East'],['J19','diamond',1200,1946,'Kingsbridge Field'],['J20','diamond',400,1946,'Greyfell South']);
// ---------------- A / B roads, coast & mountain roads, dirt tracks ----------------
const R=(name,cls,pts,extra)=>L.roads.push(Object.assign({name,cls,pts},extra||{}));
R('A1 Sound Coast Road','A',[[470,470],[600,470],[690,520],[690,610],[675,700],[640,790],[580,860],[528,898]]);
R('A2 Westmere Road','A',[[300,866],[292,960],[280,1040],[268,1108]]);
R('A2 Greyfell Road','A',[[262,1150],[200,1260],[150,1400],[140,1560],[200,1600],[300,1600]]);
R('A20 Greyfell Pass','A',[[300,1600],[350,1612],[392,1640],[346,1676],[404,1710],[352,1748],[414,1786],[362,1826],[420,1872],[400,1946]],{pass:1});
R('A3 Old Desert Road','A',[[1020,110],[1012,250],[1030,380],[1040,432]]);
R('A3 Dustwater Road','A',[[1040,490],[1060,620],[1100,760],[1080,900],[1080,1050]]);
R('A4 River Moor Road','A',[[1080,1050],[1120,1120],[1170,1240],[1160,1400],[1190,1520],[1170,1640],[1210,1790]]);
R('A5 Fenwick Road','A',[[1540,1180],[1560,1000],[1590,860],[1610,760],[1620,656]]);
R('A6 Moor Lane','A',[[1054,1200],[1200,1210],[1350,1160],[1512,1160]]);
R('A7 Dam Road','A',[[930,1400],[1040,1460],[1130,1589],[1210,1589],[1300,1600],[1418,1630]],{dam:[1138,1202]});
R('A8 Kingsbridge Road','A',[[1580,1196],[1600,1300],[1580,1446]]);
R('A9 Coast Road East','A',[[1830,560],[1880,420],[1860,250],[1830,170]]);
R('B1 Wendwood Lane','B',[[330,830],[420,800],[470,850],[492,890]]);
R('B2 Inlet Road','B',[[268,1140],[380,1230],[520,1300],[640,1340],[700,1420]]);
R('B3 Mesa Road','B',[[1100,760],[1250,640],[1330,600],[1480,560]]);
R('B4 Fen Road','B',[[1570,1200],[1700,1260],[1800,1300],[1940,1300]]);
R('B5 Summit Road','B',[[140,1600],[200,1640],[260,1650],[300,1600]]);
R('Quarry Track','D',[[1060,500],[1100,560],[1160,600]]);
R('Fen Forest Track','D',[[1700,1260],[1760,1230],[1800,1180]]);
R('Moor Forest Track','D',[[700,1420],[760,1500],[820,1560],[880,1600]]);
// ---------------- rail (red) ----------------
L.rail.push({name:'Albion–Kingsbridge Line',pts:[[520,200],[480,420],[360,700],[320,900],[420,1080],[700,1110],[1000,1130],[1180,1280],[1300,1460],[1420,1560],[1560,1700]]});
L.rail.push({name:'Northern Line',pts:[[1000,1130],[1090,980],[1200,860],[1320,760],[1500,640],[1560,500],[1600,330]]});
// ---------------- POIs (trucking) ----------------
const P=(kind,name,x,y)=>L.poi.push({kind,name,x,y});
P('depot','Big Rig Haulage HQ',230,190); P('depot','Albion Docks Terminal',600,300); P('depot','Albion Air Cargo',420,640); P('depot','Quayside Freight',430,290); P('depot','Millford Agri Depot',300,830);
P('depot','Ashby Timber Yard',268,1120); P('depot','Dustwater Mining Co',1030,470); P('depot','Sandvale Air Cargo',1350,330); P('depot','Sandvale East Freight',1790,540); P('depot','Coppermine Smelter',1620,630);
P('depot','Redhill Distribution',1020,1220); P('depot','Fenwick Cold Store',1530,1150); P('depot','Kingsbridge Container Port',1560,1800); P('depot','Harbourside Logistics',1700,1800); P('depot','Kingsbridge Field Cargo',1240,1830); P('depot','Quarry',1160,600);
P('mall','Albion Central Mall',260,300); P('mall','Sandvale Galleria',1500,300); P('mall','Kingsbridge Shopping Centre',1490,1470); P('mall','Moor Cross Retail Park',940,1100);
P('super','FreshCo Westgate',260,420); P('super','FreshCo Quayside',420,400); P('super','ValueMart Mesa',1680,400); P('super','ValueMart Old Town',1450,1660); P('super','FreshCo Redhill',1060,1230);
P('fuel','Albion Truckstop',300,420); P('fuel','Millford Services',300,850); P('fuel','Ashby Fuel',280,1140); P('fuel','Dustwater Fuel',1050,450); P('fuel','Redhill Fuel',1040,1190); P('fuel','M2 Sound Services',560,1040); P('fuel','M1 North Services',800,104);
P('fuel','M1 East Services',1940,1000); P('fuel','M3 Moor Services',940,1420); P('fuel','Kingsbridge Truckstop',1420,1760); P('fuel','Sandvale Fuel',1700,560); P('fuel','M1 South Services',700,1938);
P('dealer','Albion Truck Centre',200,440); P('dealer','Sandvale Commercials',1800,560); P('dealer','Kingsbridge Trucks',1680,1800);
P('garage','Albion Garage',360,420); P('garage','Coppermine Garage',1640,650); P('garage','Fenwick Garage',1560,1170); P('garage','Kingsbridge Garage',1600,1720); P('garage','M2 Recovery',1100,1040);
// ---------------- named places ----------------
L.labels.push(['PORT ALBION',300,250,'city'],['SANDVALE',1600,250,'city'],['KINGSBRIDGE',1560,1530,'city'],
  ['Downtown',260,300,'dist'],['Quayside',420,240,'dist'],['Westgate',250,400,'dist'],['Mesa Heights',1700,380,'dist'],['East Industrial',1810,560,'dist'],['Centre',1540,1500,'dist'],['Old Town',1440,1640,'dist'],['Harbourside',1620,1790,'dist'],
  ['Millford',300,800,'town'],['Dustwater',1040,425,'town'],['Coppermine',1625,605,'town'],['Redhill',1030,1172,'town'],['Fenwick',1535,1125,'town'],['Ashby',265,1100,'town'],['Wendwood',510,885,'town'],
  ['WESTMERE',380,1180,'region'],['THE SANDREACH',1150,600,'region'],['HIGHMOOR',1350,1300,'region'],['Mount Greyfell',290,1560,'peak'],['Greyfell Pass',420,1740,'feature'],['Sound Coast Road',720,700,'feature'],['Moor Dam & Reservoir',1172,1520,'feature'],
  ['ALBION SOUND',700,720,'water'],['SANDREACH STRAIT',1550,880,'water'],['GREYFELL INLET',560,1262,'water'],['River Moor',1190,1360,'waters'],['OUTER SEA',1024,28,'water'],['OUTER SEA',1024,2026,'water'],
  ['Greyfell Forest',650,1600,'forest'],['Fen Forest',1760,1230,'forest'],['Sandreach Desert',1250,500,'desert'],['Albion Airport',400,575,'feature'],['Sandvale Intl',1260,260,'feature'],['Kingsbridge Field',1290,1850,'feature'],['Albion Docks',600,240,'feature'],['Kingsbridge Harbour',1600,1900,'feature']);
