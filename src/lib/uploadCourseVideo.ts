export async function uploadCourseVideo(file: File, progress: (value: number) => void) {
  const endpoint="/api/classroom/video-upload";
  async function json(res: Response) { const body=await res.json();if(!res.ok)throw new Error(body.error||"Видео илгээсэнгүй");return body; }
  const start=await json(await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start",name:file.name,size:file.size})}));
  try {
    for(let offset=0,part=0;offset<file.size;offset+=start.chunkSize,part++){
      const chunk=file.slice(offset,offset+start.chunkSize);
      let sent=false;
      for(let attempt=0;attempt<3&&!sent;attempt++){
        try{await json(await fetch(`${endpoint}?id=${start.id}&part=${part}`,{method:"PUT",headers:{"Content-Type":"application/octet-stream"},body:chunk}));sent=true;}catch(e){if(attempt===2)throw e;}
      }
      progress(Math.min(99,Math.round((offset+chunk.size)/file.size*100)));
    }
    const result=await json(await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"complete",id:start.id})}));progress(100);return result as {url:string};
  }catch(e){void fetch(`${endpoint}?id=${start.id}`,{method:"DELETE"}).catch(()=>{});throw e;}
}
