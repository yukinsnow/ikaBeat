// Windows resource packaging: keep the original artwork and remove macOS canvas padding.
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source='src-tauri/icons/source/ika-original-1024.png';
const directory='src-tauri/icons/windows';
const checking=process.argv.includes('--check');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=info.width,top=info.height,right=-1,bottom=-1;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  if(data[(y*info.width+x)*4+3]!==0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
}
if(right<left)throw Error('Source icon is fully transparent');
const crop={left,top,width:right-left+1,height:bottom-top+1};
const master=await sharp(source).extract(crop).resize(1004,1004,{fit:'contain',background:'#00000000'}).extend({top:10,bottom:10,left:10,right:10,background:'#00000000'}).png().toBuffer();
const sizes=[16,24,32,48,64,96,128,256];
const frames=[];
for(const size of sizes)frames.push(await sharp(master).resize(size,size).png().toBuffer());
const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
for(let i=0;i<frames.length;i++){
 const p=6+i*16;header[p]=sizes[i]===256?0:sizes[i];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(frames[i].length,p+8);header.writeUInt32LE(offset,p+12);offset+=frames[i].length;
}
const files=new Map([
 ['icon.ico',Buffer.concat([header,...frames])],['icon.png',master],
 ['32x32.png',frames[sizes.indexOf(32)]],['128x128.png',frames[sizes.indexOf(128)]],['128x128@2x.png',frames[sizes.indexOf(256)]],
]);
if(!checking)await mkdir(directory,{recursive:true});
for(const [name,bytes] of files){
 const path=`${directory}/${name}`;
 if(checking){if(!(await readFile(path)).equals(bytes))throw Error(`Icon resource differs: ${path}`);}
 else await writeFile(path,bytes);
}
// Validate every embedded ICO image, including the 96/128 pixel desktop representations.
const ico=checking?await readFile(`${directory}/icon.ico`):files.get('icon.ico');
const measurements=[];
for(let i=0;i<sizes.length;i++){
 const entry=6+i*16,start=ico.readUInt32LE(entry+12),length=ico.readUInt32LE(entry+8);
 const {data:rgba,info:frame}=await sharp(ico.subarray(start,start+length)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let minX=frame.width,maxX=-1;
 for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++)if(rgba[(y*frame.width+x)*4+3]>=128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
 const fill=(maxX-minX+1)/frame.width;
 if(frame.width!==sizes[i]||frame.height!==sizes[i]||fill<0.93)throw Error(`Invalid ICO frame: ${sizes[i]}`);
 measurements.push({size:sizes[i],visibleWidthPercent:Math.round(fill*1000)/10});
}
console.log(JSON.stringify({mode:checking?'check':'generate',crop,frames:measurements}));
