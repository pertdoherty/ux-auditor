
'use client'
import {useState} from 'react';
export default function Home(){
 const[url,setUrl]=useState('');
 const run=async()=>{
  await fetch('http://localhost:3000/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
 };
 return(<div><input value={url} onChange={e=>setUrl(e.target.value)} /><button onClick={run}>Run</button></div>);
}
