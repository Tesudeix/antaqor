import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const m=vi.hoisted(()=>({session:vi.fn(),findOne:vi.fn(),create:vi.fn(),claim:vi.fn(),findById:vi.fn(),run:vi.fn()}));
vi.mock("@/lib/adminAuth",()=>({getAdminSession:m.session,unauthorized:()=>new Response('{"error":"Unauthorized"}',{status:401})}));
vi.mock("@/lib/mongodb",()=>({default:vi.fn()}));
vi.mock("@/models/SocialPost",()=>({default:{findOne:m.findOne,create:m.create,findOneAndUpdate:m.claim,findById:m.findById}}));
vi.mock("@/lib/socialRun",()=>({runSocialPost:m.run,savedInput:(d:unknown)=>d}));
import {POST,PATCH,DELETE} from "../src/app/api/admin/social/publish/route";
const req=(body:unknown,method="POST")=>new NextRequest("https://antaqor.com/api/admin/social/publish",{method,body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({user:{email:"admin@example.test"}});m.findOne.mockResolvedValue(null);});
describe("Publishing boundaries",()=>{
 it("requires admin auth before accepting drafts",async()=>{m.session.mockResolvedValue(null);expect((await POST(req({action:"draft",text:"test"}))).status).toBe(401);expect(m.create).not.toHaveBeenCalled();});
 it("saves incomplete drafts without publishing",async()=>{m.create.mockResolvedValue({_id:"id",state:"draft",results:[]});const res=await POST(req({action:"draft",brief:"idea"}));expect(res.status).toBe(200);expect(m.create.mock.calls[0][0].state).toBe("draft");expect(m.run).not.toHaveBeenCalled();});
 it("rejects an expired schedule before writing or publishing",async()=>{const res=await POST(req({text:"test",platforms:["threads"],threadsUserId:"uid",scheduledAt:"2020-01-01"}));expect(res.status).toBe(400);expect(m.create).not.toHaveBeenCalled();expect(m.run).not.toHaveBeenCalled();});
 it("returns an existing request without publishing twice",async()=>{m.findOne.mockResolvedValue({_id:"id",state:"published",results:[{status:"ok"}]});const res=await POST(req({text:"test",platforms:["threads"],threadsUserId:"uid",requestKey:"00000000-0000-4000-8000-000000000001"}));expect(res.status).toBe(200);expect(m.create).not.toHaveBeenCalled();expect(m.run).not.toHaveBeenCalled();});
 it("rejects retry on a successful or uncertain network",async()=>{for(const status of ["ok","unknown"]){m.findById.mockResolvedValue({platforms:["threads"],results:[{platform:"threads",status}]});expect((await PATCH(req({id:"507f1f77bcf86cd799439011",platform:"threads"},"PATCH"))).status).toBe(409);}expect(m.claim).not.toHaveBeenCalled();});
 it("cancels a queued post by preserving it as a draft",async()=>{m.claim.mockResolvedValue({_id:"id"});const res=await DELETE(new NextRequest("https://antaqor.com/api/admin/social/publish?id=507f1f77bcf86cd799439011",{method:"DELETE"}));expect(res.status).toBe(200);expect(m.claim.mock.calls[0][1].$set.state).toBe("draft");expect(m.claim.mock.calls[0][0].state).toBe("scheduled");});
});
