import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateGenerations, findInterGenerationalCouples } from '../src/services/layout/generationalRanking.ts';
import type { TreeData, Person, Union } from '../src/types/tree.ts';

// Compact transcription of a real 165-person tree (names shortened): the stored `generation`
// values (G) and each union as `id|partners|children` (U).
const G = `
JFerrW:-5 HesterW:-3 CecDP:-7 AnnaBrill:-2 Riana:1 Ian:2 Charma:2 Tania:1 DavidBrillSr:-2 Afkenel:1
JohanBez:1 Diederika:1 Kathleen:1 Caroline:0 gfSmith:2 IsabellaS:-3 Hansie:0 James:1 JeanDP:-8 CorneliaBrill:-1
MariaDP:-4 Michelle:3 Minnie:0 Yolandi:1 PaulusVR:-3 SusaraMeyer:-1 MarieMen:-8 JacobusPret:-2 LeaR:1 WilhSmit:-3
CathBrill:-1 Sienna:3 JohanDP:1 Hunter:3 Marietjie:1 Lilly:2 Willie:0 Carolus:-5 Victoria:2 Gertruida:-6
Isabel:3 AdriaanDP:2 CharlDP:-7 MarthaDP:0 MarthaJvR:-2 SusaraOtto:0 JJ:2 Bellane:3 Frikkie:1 JohannL:2
Haans:1 Margeritha:-2 Carlynne:2 DanielDP4:-4 AnnaFerr:-3 DanielDP2:-2 Elize:2 WilhFourie:-1 HesterBrill:-1 Marco:3
Divan:3 JurieBatho:0 DavidBrillJr:-1 Jurieanna:0 ElizBritz:-3 MariaFerr:-7 GerhardusPret:-1 Eliana:3 DanielDP6:-6 BarendF:-2
DanielDPc:0 AndriesF:-3 Marinda:1 FrancoisJr:3 Lourens:2 Hendrina:-1 ThomasF5:-5 Inge:2 JohannaBrill:-1 Kayleigh:2
MarthaJvV:-2 Bason:-1 JurieF3:-3 KoosPret:0 Maxine:-1 JurieMaree:1 MariaPret:-1 JohannaVdW:-5 MariaFourie:-3 CatherineR:2
Dewan:2 Henk:1 Lydia:-1 Dolly:0 JohannesJvR:-2 WilhelmDP:1 DanielDK:-2 Kobus:1 JohannesWilken:-3 JohannesDP3:-3
Relandie:2 JohannesDPa:-1 Sarel:0 Rudolf:-3 Gerhard:1 Marelize:2 JohannesDB:1 Mieke:3 JohannesBrill:-1 AndriesBrill:-1
JurieBrits:-1 Gavin:2 Suzana:0 Klarien:2 Michael:1 Laurika:2 Fanie:0 Sanet:1 Meyer:-1 JurieB:1
Jaco:2 FrancoisB:2 MariaDK:-2 ElizPret:-3 AnnaMarie:1 Andrew:2 Eben:3 ThomasF6:-6 AnnaSchHat:-2 Jayden:3
Kiewiet:1 JohannesS3:-3 LeaS:0 Mickayla:3 SusaraVZ:-2 Anelies:1 Koos:0 GerhardusPret3:-3 JohannesH:-3 Aileen:2
CorneliaFerr:-2 JohannesS2:-2 MariaHat:-3 CorneliaSw:-4 JacobusBritz:-2 HenkT:0 AnnaSchoeman:-1 Kittie:0 Charlene:2 JurieF4:-4
Helena:-6 Luan:2 Deon:2 AnnaBrill2:-1 JurieT:1 Jacques:1 CorneliaSept:-3 AnnaJacobs:-3 Daniela:2 Samantha:2
AdriaanBrill:-3 Anita:1 AnnaB:0 MariaB:0 ThomasF7:-7
`;
const U = `
e7btlet|Suzana HenkT|Henk JurieT
z9sm7b5|Marelize JohannL|
b2phuf4|JurieBrits Maxine|
drfhxl6|AdriaanBrill CorneliaSept|DavidBrillSr
javvenv|DanielDP4 MariaDP|JohannesDP3
cjzi60s|Kathleen|Relandie Klarien
fgdy4ea|Gerhard Yolandi|Lilly
ue4qsi3|James|Inge
pve85zj|Carlynne Deon|Jayden Divan Mickayla
o24wsmh|Carolus JohannaVdW|DanielDP4
lki3uby|JacobusBritz CorneliaFerr|JurieBrits
ug34xx4|JurieF3 AnnaFerr|CorneliaFerr
hyhq4wm|BarendF Margeritha|WilhFourie
gn0vib5|Henk Anelies|Ian Kayleigh
6i7fwzu|Marinda JohanBez|Laurika
yv66yk8|FrancoisB Elize|FrancoisJr Michelle
ctdmu85|PaulusVR AnnaJacobs|AnnaBrill
eazhce2|JurieBrits AnnaSchoeman|Koos Kittie AnnaB
z4fot5p|Jaco Charlene|Eben Isabel
wqjf2yl|Rudolf ElizBritz|JacobusBritz
1bnka5g|Gerhard Marinda|Victoria
8a945sc|WilhFourie SusaraMeyer|Minnie
i8vc5a9|SusaraOtto|Sanet
r35kffa|JacobusPret SusaraVZ|GerhardusPret
ds6m4g2|JurieF4 CorneliaSw|JurieF3
baep1oe|Hansie Minnie|Riana Marinda WilhelmDP JohanDP
ficrk8m|GerhardusPret MariaPret|MariaB SusaraOtto KoosPret
uciohb9|Marietjie Michael|CatherineR Samantha
nrh77ag|Aileen Dewan|Marco Bellane
v9d66k5|DavidBrillSr AnnaBrill|SusaraMeyer AnnaBrill2 DavidBrillJr JohannaBrill Hendrina CorneliaBrill CathBrill HesterBrill AndriesBrill JohannesBrill
yo353s8|James LeaR|JJ
3c8930t|HenkT|Afkenel Diederika
wlxzqpq|ThomasF7 MariaFerr|ThomasF6
8khy71y|CharlDP CecDP|DanielDP6
ywm92h4|AnnaB|LeaS
p60r541|Samantha Andrew|Sienna
qtve09o|JohannesS2 AnnaSchHat|AnnaSchoeman
z6qi9yz|JurieB Riana|gfSmith Jaco Carlynne
12cidlb|CatherineR Gavin|Hunter
cmzw7y6|GerhardusPret3 ElizPret|JacobusPret
7u12v6l|Victoria Lourens|Mieke
zoxqvhd|Tania JohannesDB|Luan
ed23fql|JohannesWilken HesterW|Margeritha
s1lremg|Kobus Kathleen|
sioqsky|JohannesJvR MarthaJvR|Lydia
gigw3a4|ThomasF5 JFerrW|JurieF4
1k2lpqm|Sarel LeaS|LeaR Jacques
hpvoev3|Anita Frikkie|Marelize FrancoisB Aileen
1gvbriy|JohannesS3 IsabellaS|JohannesS2
1ic1wqg|JurieBrits Bason|Suzana Caroline JurieBatho Willie Dolly Jurieanna
zsd4nvs|Kittie Fanie|AnnaMarie Haans JurieMaree
k8agv8s|MariaB Koos|JurieB Gerhard Kobus Anita Marietjie
79bh7th|AndriesF MariaFourie|BarendF
2vv4v4v|JohannesH MariaHat|AnnaSchHat
lz8pe6a|DanielDP2 MarthaJvV|JohannesDPa
bf2rarn|ThomasF6 Gertruida|ThomasF5
e91eyub|SusaraMeyer Meyer|
r04bk2c|DanielDP6 Helena|Carolus
2gwuyqf|JohannesDP3 WilhSmit|DanielDP2
d5gk5ff|JeanDP MarieMen|CharlDP
w6sefha|DanielDK MariaDK|MariaPret
p3qmcfw|WilhelmDP Kiewiet|AdriaanDP Charma
vsqeh4s|gfSmith Daniela|Eliana
a2u02xr|Lydia JohannesDPa|Hansie MarthaDP DanielDPc
0892kt3|James Tania|Charlene
`;

function buildTree(useStored: boolean): TreeData {
  const people: Record<string, Person> = {};
  for (const tok of G.split(/\s+/).filter(Boolean)) {
    const [n, g] = tok.split(':');
    people[n] = { id: n, firstName: n, unionIds: [], ...(useStored ? { generation: Number(g) } : {}) };
  }
  const unions: Record<string, Union> = {};
  for (const line of U.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [id, ps, cs] = line.split('|');
    const partnerIds = ps.split(' ').filter(Boolean);
    const childrenIds = (cs || '').split(' ').filter(Boolean);
    unions[id] = { id, partnerIds, childrenIds, type: 'married' };
    for (const p of partnerIds) people[p].unionIds.push(id);
    for (const c of childrenIds) people[c].parentUnionId = id;
  }
  return { id: 't', name: 't', createdAt: '', updatedAt: '', people, unions };
}

describe('large real-world tree with an inter-generational marriage', () => {
  for (const useStored of [true, false]) {
    it(`keeps James, Lea, Tania and Johannes DB alone on the row above Jaco and Charlene (stored generations: ${useStored})`, () => {
      const tree = buildTree(useStored);
      const couples = findInterGenerationalCouples(tree);
      assert.deepStrictEqual(couples.map((c) => [c.olderId, c.youngerId]), [['Jaco', 'Charlene']]);

      const g = calculateGenerations(tree);
      const onRow = (row: number) => Object.keys(g).filter((id) => g[id] === row).sort();

      assert.deepStrictEqual(onRow(g.James), ['James', 'JohannesDB', 'LeaR', 'Tania']);
      assert.strictEqual(g.Charlene, g.James + 1);
      assert.strictEqual(g.Jaco, g.Charlene);
      // Jaco's brother, sister and cousins follow him to the same row
      assert.strictEqual(g.gfSmith, g.Jaco);
      assert.strictEqual(g.Carlynne, g.Jaco);
      // Jurie and his siblings stay level, one row below their parents
      for (const sib of ['Gerhard', 'Kobus', 'Anita', 'Marietjie', 'Riana']) {
        assert.strictEqual(g[sib], g.JurieB, sib + ' level with Jurie');
      }
      assert.strictEqual(g.Koos, g.MariaB);
      assert.strictEqual(g.JurieB, g.Koos + 1);
      assert.strictEqual(g.James, g.JurieB + 1);
      // Charlene's child Eben is below the couple
      assert.strictEqual(g.Eben, g.Jaco + 1);
    });
  }
});