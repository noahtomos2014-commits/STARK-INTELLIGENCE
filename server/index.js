import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
const app=express();
const PORT=Number(process.env.PORT)||3000;
const here=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:'1mb'}));
app.get('/api/health',(_req,res)=>res.json({status:'online',aiConfigured:Boolean(process.env.GEMINI_API_KEY)}));
app.post('/api/chat',async(req,res)=>{
 try{
  if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'Gemini is not configured. Add GEMINI_API_KEY to your Render environment variables.'});
  const message=typeof req.body?.message==='string'?req.body.message.trim():'';
  if(!message)return res.status(400).json({error:'Please enter a message.'});
  if(message.length>12000)return res.status(413).json({error:'Message is too long.'});
  const history=Array.isArray(req.body?.history)?req.body.history.slice(-16):[];
  const contents=history.filter(x=>x&&['user','model'].includes(x.role)&&typeof x.text==='string').map(x=>({role:x.role,parts:[{text:x.text.slice(0,12000)}]}));
  contents.push({role:'user',parts:[{text:message}]});
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
  const result=await ai.models.generateContent({model:'gemini-3.8-flash',contents,config:{systemInstruction:'You are JARVIS, the personal AI assistant for STARK INTELLIGENCE. Be intelligent, calm, polished, concise but useful, and lightly witty. Answer the actual question with fresh reasoning. Admit uncertainty. Never claim to have performed actions you cannot perform.'}});
  const reply=result.text?.trim();
  if(!reply)return res.status(502).json({error:'Gemini returned an empty response. Please try again.'});
  res.json({reply,model:'gemini-3.8-flash'});
 }catch(error){console.error('Gemini request failed:',error);res.status(500).json({error:'Gemini request failed. Check your API key and server logs.'});}
});
const dist=path.resolve(here,'../dist');
app.use(express.static(dist));
app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));
app.listen(PORT,()=>console.log('STARK INTELLIGENCE listening on '+PORT));
