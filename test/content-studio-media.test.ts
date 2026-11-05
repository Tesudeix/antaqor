import { describe,it,expect,vi,beforeAll,afterAll } from "vitest";
import { mkdtemp,mkdir,rm,writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";
import { NextRequest } from "next/server";
vi.mock("@/lib/adminAuth",()=>({getAdminSession:async()=>({user:{email:"test@example.test"}}),unauthorized:()=>new Response("",{status:401})}));
import {POST as reel} from "../src/app/api/admin/social/reel/route";
import {POST as upload} from "../src/app/api/admin/social/video/route";
let folder="";
beforeAll(async()=>{folder=await mkdtemp(path.join(tmpdir(),"studio-media-test-"));await mkdir(path.join(folder,"public/uploads"),{recursive:true});await sharp({create:{width:720,height:1280,channels:3,background:"#25262b"}}).jpeg().toFile(path.join(folder,"public/uploads/test.jpg"));vi.spyOn(process,"cwd").mockReturnValue(folder);});
afterAll(async()=>{vi.restoreAllMocks();await rm(folder,{recursive:true,force:true});});
describe("Media pipeline",()=>{
 it("rejects external sources for server-side rendering",async()=>{const r=await reel(new NextRequest("https://antaqor.com/api/admin/social/reel",{method:"POST",body:JSON.stringify({imageUrl:"https://other.example/file.jpg"})}));expect(r.status).toBe(400);});
 it("renders a real MP4 and accepts it through the video validator",async()=>{
   const r=await reel(new NextRequest("https://antaqor.com/api/admin/social/reel",{method:"POST",body:JSON.stringify({imageUrl:"https://antaqor.com/uploads/test.jpg"})}));const out=await r.json();expect(r.status).toBe(200);expect(out.duration).toBe(10);
   const {readFile}=await import("fs/promises");const bytes=await readFile(path.join(folder,"public/uploads",path.basename(new URL(out.url).pathname)));
   const form=new FormData();form.append("file",new File([bytes],"test.mp4",{type:"video/mp4"}));
   const verified=await upload(new NextRequest("https://antaqor.com/api/admin/social/video",{method:"POST",body:form}));expect(verified.status).toBe(200);const video=await verified.json();expect(video.width).toBe(720);expect(video.height).toBe(1280);expect(video.duration).toBe(10);
 },60000);
 it("rejects non-video bytes renamed to MP4",async()=>{const form=new FormData();form.append("file",new File(["not a video"],"test.mp4",{type:"video/mp4"}));const r=await upload(new NextRequest("https://antaqor.com/api/admin/social/video",{method:"POST",body:form}));expect(r.status).toBe(400);});
});
