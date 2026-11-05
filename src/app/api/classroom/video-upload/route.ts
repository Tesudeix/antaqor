import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { mkdir, writeFile, readFile, stat, rename, rm, readdir, open } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
const ROOT = path.join(process.cwd(), "work", "course-video-uploads");
const DEST = path.join(process.cwd(), "public", "uploads");
const CHUNK = 8 * 1024 * 1024;
const MAX = 4 * 1024 * 1024 * 1024;
const validId = (v: string) => /^[a-f0-9-]{36}$/.test(v);
async function owner() { const session = await getServerSession(authOptions); return session?.user && isAdmin(session.user.email) ? session.user.email : null; }
async function metadata(id: string, user: string) {
  if (!validId(id)) throw new Error("Upload олдсонгүй");
  const data = JSON.parse(await readFile(path.join(ROOT,id,"meta.json"),"utf8"));
  if(data.owner !== user || Date.now()-data.created > 86400000) throw new Error("Upload хугацаа дууссан");
  return data as {owner:string;size:number;ext:string;created:number};
}
export async function POST(req: NextRequest) {
  const user=await owner(); if(!user)return NextResponse.json({error:"Admin access required"},{status:403});
  try {
    const body=await req.json();
    if(body.action==="start") {
      const ext=String(body.name||"").split(".").pop()?.toLowerCase();
      if(!ext || !["mp4","webm","mov","m4v","ogg"].includes(ext) || !Number.isSafeInteger(body.size) || body.size<=0 || body.size>MAX)return NextResponse.json({error:"MP4, WebM, MOV, M4V, OGG · хамгийн ихдээ 4 GB"},{status:400});
      await mkdir(ROOT,{recursive:true});
      // Expire abandoned uploads without touching any published videos.
      for(const entry of await readdir(ROOT)) { if(!validId(entry))continue; const dir=path.join(ROOT,entry); const info=await stat(dir).catch(()=>null); if(info && Date.now()-info.mtimeMs>86400000)await rm(dir,{recursive:true,force:true}); }
      const id=randomUUID(); await mkdir(path.join(ROOT,id));
      await writeFile(path.join(ROOT,id,"meta.json"),JSON.stringify({owner:user,size:body.size,ext,created:Date.now()}));
      return NextResponse.json({id,chunkSize:CHUNK});
    }
    const id=String(body.id||""); const meta=await metadata(id,user); const dir=path.join(ROOT,id);
    if(body.action!=="complete")return NextResponse.json({error:"Invalid action"},{status:400});
    const lock=await open(path.join(dir,"finalizing"),"wx"); await lock.close();
    try {
      const count=Math.ceil(meta.size/CHUNK);
      for(let i=0;i<count;i++){const part=await stat(path.join(dir,String(i)));if(part.size!==Math.min(CHUNK,meta.size-i*CHUNK))throw new Error("Видео бүрэн илгээгдээгүй");}
      await mkdir(DEST,{recursive:true});
      const file=await open(path.join(dir,"assembled"),"w");
      try {for(let i=0;i<count;i++)await file.writeFile(await readFile(path.join(dir,String(i))));}finally{await file.close();}
      const name=`lesson-${id}.${meta.ext}`;
      await rename(path.join(dir,"assembled"),path.join(DEST,name));
      await rm(dir,{recursive:true,force:true});
      return NextResponse.json({url:`/uploads/${name}`,size:meta.size});
    } catch(e){await rm(path.join(dir,"finalizing"),{force:true});throw e;}
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Upload алдаа"},{status:400});}
}
export async function PUT(req: NextRequest) {
  const user=await owner();if(!user)return NextResponse.json({error:"Admin access required"},{status:403});
  let temp="";
  try {
    const id=req.nextUrl.searchParams.get("id")||"";const index=Number(req.nextUrl.searchParams.get("part"));const meta=await metadata(id,user);
    if(!Number.isInteger(index)||index<0||index>=Math.ceil(meta.size/CHUNK))throw new Error("Invalid part");
    const expected=Math.min(CHUNK,meta.size-index*CHUNK);
    if(Number(req.headers.get("content-length"))>expected)throw new Error("Part too large");
    if(!req.body)throw new Error("Empty part");
    if(await stat(path.join(ROOT,id,"finalizing")).catch(()=>null))throw new Error("Finalizing");
    temp=path.join(ROOT,id,`${index}-${randomUUID()}.tmp`);const file=await open(temp,"wx");let size=0;
    const reader=req.body.getReader();
    try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>expected){await reader.cancel();throw new Error("Part too large");}await file.writeFile(value);}if(size!==expected)throw new Error("Incomplete part");}finally{await file.close();}
    await rename(temp,path.join(ROOT,id,String(index)));return NextResponse.json({ok:true});
  }catch(e){if(temp)await rm(temp,{force:true});return NextResponse.json({error:e instanceof Error?e.message:"Upload алдаа"},{status:400});}
}
export async function DELETE(req: NextRequest){const user=await owner();if(!user)return NextResponse.json({error:"Admin access required"},{status:403});const id=req.nextUrl.searchParams.get("id")||"";try{await metadata(id,user);await rm(path.join(ROOT,id),{recursive:true,force:true});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Not found"},{status:404});}}
export const dynamic="force-dynamic";
export const maxDuration=300;
