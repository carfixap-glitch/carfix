"use client";

import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

const carModels: Record<string, string[]> = {
  "Maruti Suzuki": ["Alto K10","S-Presso","Celerio","Wagon R","Ignis","Swift","Dzire","Baleno","Fronx","Brezza","Grand Vitara","Ertiga","XL6","Eeco","Jimny","Invicto","Ciaz"],
  "Hyundai": ["Grand i10 Nios","i20","i20 N Line","Exter","Aura","Venue","Venue N Line","Creta","Creta Electric","Alcazar","Verna","Tucson","Ioniq 5"],
  "Tata Motors": ["Tiago","Tiago NRG","Tigor","Altroz","Punch","Punch EV","Nexon","Nexon EV","Curvv","Curvv EV","Harrier","Harrier EV","Safari","Sierra"],
  "Mahindra": ["Bolero","Bolero Neo","Scorpio Classic","Scorpio N","Thar","Thar Roxx","XUV 3XO","XUV700","XUV400","BE 6","XEV 9e"],
  "Toyota": ["Glanza","Urban Cruiser Hyryder","Rumion","Innova Crysta","Innova HyCross","Fortuner","Fortuner Legender","Hilux","Camry","Vellfire","Land Cruiser 250","Land Cruiser 300"],
  "Kia": ["Sonet","Seltos","Carens","Carens Clavis","Carnival","EV6","EV9"],
  "Honda": ["Amaze","City","Elevate"],
  "Renault": ["Kwid","Triber","Kiger"],
  "Nissan": ["Magnite","X-Trail"],
  "Skoda": ["Slavia","Kushaq","Kodiaq","Superb"],
  "Volkswagen": ["Virtus","Taigun","Tiguan"],
  "MG Motor": ["Comet EV","Astor","Hector","Hector Plus","Gloster","Windsor EV","ZS EV","Cyberster"],
  "Jeep": ["Compass","Meridian","Wrangler","Grand Cherokee"],
  "Citroën": ["C3","C3 Aircross","C3 Aircross X","Basalt","eC3"],
  "BYD": ["Atto 3","e6","Seal","Sealion 7"],
  "Isuzu": ["D-Max","V-Cross","MU-X"],
  "Force Motors": ["Gurkha","Gurkha 5 Door","Trax Cruiser"],
  "BMW": ["2 Series Gran Coupe","3 Series","5 Series","7 Series","X1","X3","X5","X7","i4","i5","i7","iX"],
  "Mercedes-Benz": ["A-Class Limousine","C-Class","E-Class","S-Class","GLA","GLB","GLC","GLE","GLS","EQA","EQE","EQS"],
  "Audi": ["A4","A6","A8 L","Q3","Q5","Q7","Q8","Q3 Sportback","e-tron","Q8 e-tron"],
  "Volvo": ["EX30","XC40","XC40 Recharge","XC60","XC90","S90","C40 Recharge"],
  "Jaguar": ["F-Pace","F-Type","I-Pace"],
  "Land Rover": ["Range Rover Evoque","Range Rover Velar","Range Rover Sport","Range Rover","Discovery Sport","Discovery","Defender"],
  "Lexus": ["ES","NX","RX","LX","LM"],
  "Porsche": ["Macan","Cayenne","Panamera","911","Taycan"],
  "MINI": ["Cooper 3 Door","Cooper 5 Door","Countryman","Convertible"],
  "Tesla": ["Model 3","Model Y"],
  "VinFast": ["VF 6","VF 7","VF 8","VF 9"],
};

const makes = Object.keys(carModels);

export default function NewAssessmentPage() {
  const [make,setMake]=useState("");
  const [model,setModel]=useState("");
  const [city,setCity]=useState("");
  const [photos,setPhotos]=useState<File[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const supabase=createClient();

  function addPhotos(list: FileList|null){
    if(!list)return;
    const next=[...photos,...Array.from(list)].filter((f,i,a)=>i===a.findIndex(x=>x.name===f.name&&x.size===f.size));
    setPhotos(next.slice(0,10));
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!make || !model){setMessage("Please select the car make and model.");return;}
    if(!photos.length){setMessage("Please add at least one damage photo.");return;}
    setBusy(true);
    setMessage("Saving assessment...");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}

    const {data:vehicle,error:ve}=await supabase
      .from("vehicles")
      .insert({user_id:user.id,make,model,year:null,registration_number:null})
      .select("id")
      .single();

    if(ve){setBusy(false);setMessage(ve.message);return;}

    const {data:assessment,error:ae}=await supabase
      .from("assessments")
      .insert({user_id:user.id,vehicle_id:vehicle.id,city,status:"pending"})
      .select("id")
      .single();

    if(ae){setBusy(false);setMessage(ae.message);return;}

    for(const file of photos){
      const path=`${user.id}/${assessment.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const {error:up}=await supabase.storage
        .from("carfix-damage-photos")
        .upload(path,file,{contentType:file.type||"image/jpeg",upsert:false});

      if(up){setBusy(false);setMessage(`Photo upload failed: ${up.message}`);return;}

      const {error:pe}=await supabase
        .from("assessment_photos")
        .insert({assessment_id:assessment.id,storage_path:path,photo_type:"damage"});

      if(pe){setBusy(false);setMessage(pe.message);return;}
    }

    window.location.href=`/assessments/${assessment.id}`;
  }

  return <main className="section">
    <div className="container" style={{maxWidth:760}}>
      <a href="/dashboard">← Dashboard</a>
      <div className="card" style={{marginTop:25}}>
        <p className="muted">Step 1</p>
        <h1>Start a car damage assessment</h1>
        <p className="muted">Select your car, city, and add clear photos of the damage.</p>

        <form onSubmit={submit} style={{display:"grid",gap:14,marginTop:25}}>
          <div className="grid" style={{gridTemplateColumns:"1fr 1fr"}}>
            <select
              value={make}
              onChange={e=>{setMake(e.target.value);setModel("");}}
              required
              style={{padding:14,border:"1px solid #d8dee9",borderRadius:9,background:"white"}}
            >
              <option value="">Select car make</option>
              {makes.map((item)=><option key={item} value={item}>{item}</option>)}
            </select>

            <select
              value={model}
              onChange={e=>setModel(e.target.value)}
              required
              disabled={!make}
              style={{padding:14,border:"1px solid #d8dee9",borderRadius:9,background:"white"}}
            >
              <option value="">{make ? "Select car model" : "Select make first"}</option>
              {(carModels[make] ?? []).map((item)=><option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <input
            placeholder="City"
            value={city}
            onChange={e=>setCity(e.target.value)}
            required
            style={{padding:14,border:"1px solid #d8dee9",borderRadius:9}}
          />

          <div style={{padding:20,border:"2px dashed #cbd5e1",borderRadius:12}}>
            <h3>Damage photos</h3>
            <p className="muted">Upload up to 10 photos. Use clear photos from different angles.</p>
            <input ref={input} type="file" accept="image/*" multiple onChange={e=>addPhotos(e.target.files)} style={{marginTop:10}}/>
            <p className="muted">{photos.length} photo{photos.length===1?"":"s"} selected</p>
            {photos.length>0&&<ul>{photos.map((p,i)=><li key={`${p.name}-${i}`}>{p.name}</li>)}</ul>}
          </div>

          <button className="btn primary" disabled={busy} type="submit">
            {busy?"Saving...":"Create assessment"}
          </button>
          {message&&<p className="muted">{message}</p>}
        </form>
      </div>
    </div>
  </main>;
}
