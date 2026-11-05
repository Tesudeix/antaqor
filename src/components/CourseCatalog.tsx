"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import s from "./CreatorLanding.module.css";
type Course = { _id: string; title: string; description: string; coverImage?: string; thumbnail?: string; comingSoon?: boolean; lessons: { id: string; title: string; durationSec: number }[] };
export default function CourseCatalog() {
  const [courses,setCourses] = useState<Course[] | null>(null);
  const [error,setError] = useState(false);
  useEffect(() => { let active=true; fetch("/api/classroom/catalog").then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(active)setCourses(d.courses);}).catch(()=>{if(active)setError(true);});return()=>{active=false;}; },[]);
  return <div className={s.page}><p className={s.eyebrow}>ANTAQOR / CLASSROOM</p><div className={s.heading}><div><h1 style={{fontSize:32,fontWeight:800,marginBottom:12}}>Сургалтууд</h1><p className={s.body}>Юу сурахаа эхлээд хараарай. Хөтөлбөр нээлттэй, хичээлүүд гишүүдэд зориулагдсан.</p></div><Link href="/#enroll" className={s.primary}>Хүрээлэлд нэгдэх <Icon name="arrow" size={16}/></Link></div>
  {error ? <div className={s.empty}>Сургалтуудыг ачаалж чадсангүй. <button type="button" onClick={()=>window.location.reload()} className={s.plain}>Дахин оролдох</button></div> : courses === null ? <div className={s.empty} role="status">Сургалтуудыг ачаалж байна…</div> : !courses.length ? <div className={s.empty}>Сургалтууд удахгүй нэмэгдэнэ.</div> : <div className={s.catalog}>{courses.map(c=><details className={s.course} key={c._id}><summary>{c.coverImage||c.thumbnail ? <img src={c.coverImage||c.thumbnail} alt="" className={s.cover} loading="lazy"/> : <div className={`${s.cover} ${s.coverFallback}`}><Icon name="book" size={32}/></div>}<div className={s.courseBody}><p className={s.eyebrow}>{c.comingSoon?"УДАХГҮЙ":`${c.lessons.length} ХИЧЭЭЛ · ГИШҮҮДЭД`}</p><h2>{c.title}</h2><p className={s.note}>{c.description}</p><p className={s.note}>Хичээлийн жагсаалтыг харах ↓</p></div></summary><ul className={s.lessons}>{c.lessons.map(l=><li key={l.id}><span><Icon name="lock" size={16}/>{l.title}</span><small className={s.locked}>{l.durationSec>0?`${Math.ceil(l.durationSec/60)} мин`:"Түгжээтэй"}</small></li>)}<li><Link href="/auth/signup?plan=builder" className={s.primary}>Нэгдэж хичээлээ нээх <Icon name="arrow" size={16}/></Link></li></ul></details>)}</div>}<p className={s.note}>Хичээлийн видео, текст, хавсралтыг төлбөр баталгаажсаны дараа нээнэ.</p></div>;
}
