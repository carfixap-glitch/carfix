"use client";

import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

const carModels: Record<string, string[]> = {
  "Maruti Suzuki": ["800","Alto","Alto K10","Omni","Zen","Zen Estilo","Wagon R","A-Star","Celerio","S-Presso","Ritz","Ignis","Swift","Swift Dzire","Dzire","Baleno","Baleno RS","Fronx","Brezza","Vitara Brezza","S-Cross","Grand Vitara","Ertiga","XL6","Eeco","Versa","Gypsy","Gypsy King","Esteem","Baleno Sedan","SX4","Ciaz","Kizashi","Jimny","Invicto","Victoris","e Vitara"],
  "Hyundai": ["Santro","Santro Xing","i10","Grand i10","Grand i10 Nios","Getz","Eon","i20","i20 Active","i20 N Line","Accent","Xcent","Aura","Verna","Sonata","Sonata Embera","Elantra","Terracan","Tucson","Santa Fe","Creta","Creta N Line","Creta Electric","Venue","Venue N Line","Exter","Alcazar","Kona Electric","Ioniq 5"],
  "Tata Motors": ["Indica","Indica V2","Indica Vista","Indica EV","Indigo","Indigo Marina","Indigo CS","Indigo Manza","Estate","Sierra","Sumo","Sumo Gold","Safari","Safari Storme","Aria","Hexa","Nano","Bolt","Zest","Tiago","Tiago NRG","Tiago JTP","Tigor","Tigor JTP","Altroz","Altroz Racer","Punch","Punch EV","Nexon","Nexon EV","Curvv","Curvv EV","Harrier","Harrier EV","Safari","Sierra"],
  "Mahindra": ["Armada","Marshal","Commander","Classic","Bolero","Bolero Invader","Bolero Camper","Bolero Neo","Bolero Neo Plus","Scorpio","Scorpio Classic","Scorpio N","Xylo","Quanto","NuvoSport","Verito","Logan","Thar","Thar Roxx","TUV300","KUV100","KUV100 NXT","XUV500","XUV300","XUV 3XO","XUV400","XUV700","Marazzo","Alturas G4","BE 6","XEV 9e","XUV 7XO"],
  "Toyota": ["Qualis","Camry","Corolla","Corolla Altis","Prius","Etios","Etios Liva","Etios Cross","Yaris","Platinum Etios","Urban Cruiser","Urban Cruiser Taisor","Urban Cruiser Hyryder","Glanza","Rumion","Innova","Innova Crysta","Innova HyCross","Fortuner","Fortuner Legender","Hilux","Vellfire","Land Cruiser Prado","Land Cruiser 250","Land Cruiser 300","RAV4"],
  "Honda": ["City","City ZX","Civic","Civic Hybrid","Accord","Accord Hybrid","CR-V","Brio","Amaze","Mobilio","Jazz","WR-V","BR-V","Elevate","City e:HEV"],
  "Kia": ["Sonet","Seltos","Carens","Carens Clavis","Carnival","EV6","EV9"],
  "Ford": ["Ikon","Fiesta","Fiesta Classic","Fusion","Mondeo","Endeavour","EcoSport","Figo","Figo Aspire","Aspire","Freestyle","Mustang"],
  "Chevrolet": ["Spark","Matiz","Beat","Aveo","Aveo U-VA","Optra","Optra Magnum","Cruze","Sail","Sail Hatchback","Enjoy","Tavera","Captiva","Trailblazer"],
  "Fiat": ["Uno","Siena","Palio","Palio Adventure","Palio Weekend","Petra","Punto","Grande Punto","Punto Evo","Linea","Linea Classic","Avventura","500","Bravo","Abarth Punto","Abarth 595"],
  "Renault": ["Logan","Pulse","Fluence","Koleos","Scala","Duster","Lodgy","Captur","Kwid","Triber","Kiger","Arkana"],
  "Nissan": ["Micra","Micra Active","Sunny","Teana","X-Trail","Terrano","Evalia","Kicks","Magnite"],
  "Datsun": ["Go","Go+","redi-GO"],
  "Mitsubishi": ["Lancer","Lancer Cedia","Cedia","Pajero","Pajero Sport","Montero","Outlander","Carisma"],
  "Skoda": ["Octavia","Octavia RS","Fabia","Laura","Rapid","Rapid Monte Carlo","Yeti","Superb","Kushaq","Slavia","Kylaq","Kodiaq"],
  "Volkswagen": ["Polo","Polo GT","Polo GT TSI","Vento","Ameo","Jetta","Passat","Beetle","Touareg","Tiguan","Virtus","Taigun"],
  "Mitsubishi": ["Lancer","Lancer Cedia","Cedia","Pajero","Pajero Sport","Montero","Outlander","Carisma"],
  "MG Motor": ["ZS EV","Hector","Hector Plus","Gloster","Astor","Comet EV","Windsor EV","Cyberster","Majestor"],
  "Jeep": ["Compass","Meridian","Wrangler","Grand Cherokee","Avenger"],
  "Citroën": ["C3","eC3","C3 Aircross","C3 Aircross X","Basalt"],
  "BYD": ["e6","Atto 3","Seal","Sealion 7"],
  "Isuzu": ["D-Max","V-Cross","MU-7","MU-X"],
  "Force Motors": ["Gurkha","Gurkha 3 Door","Gurkha 5 Door","Trax Cruiser","Trax Toofan"],
  "SsangYong": ["Rexton","Rexton W","Rodius","Korando"],
  "Opel": ["Astra","Astra 1.6","Corsa","Corsa Sail","Corsa Swing","Vectra"],
  "Daewoo": ["Cielo","Matiz","Nubira","Espero"],
  "Hindustan Motors": ["Ambassador","Contessa"],
  "Premier": ["Padmini","118 NE","Rio"],
  "BMW": ["3 Series","5 Series","7 Series","1 Series","2 Series Gran Coupe","6 Series","8 Series","X1","X3","X5","X6","X7","XM","Z4","i4","i5","i7","i8","iX","iX1"],
  "Mercedes-Benz": ["A-Class","A-Class Limousine","B-Class","C-Class","E-Class","S-Class","CLA","CLS","GLA","GLB","GLC","GLK","GLE","GLS","M-Class","G-Class","V-Class","EQA","EQB","EQE","EQS","Maybach GLS","Maybach S-Class"],
  "Audi": ["A3","A4","A5","A6","A7","A8","A8 L","Q2","Q3","Q3 Sportback","Q5","Q7","Q8","R8","TT","S5 Sportback","RS5","RS7","RS Q8","e-tron","Q8 e-tron","e-tron GT"],
  "Volvo": ["S40","S60","S80","S90","V40","V40 Cross Country","V90 Cross Country","XC40","XC40 Recharge","XC60","XC90","C30","C40 Recharge","EC40","EX30"],
  "Jaguar": ["X-Type","XF","XJ","XE","F-Pace","F-Type","I-Pace"],
  "Land Rover": ["Freelander","Freelander 2","Range Rover","Range Rover Sport","Range Rover Evoque","Range Rover Velar","Discovery","Discovery 3","Discovery 4","Discovery Sport","Defender"],
  "Lexus": ["ES","IS","NX","RX","LX","LC","LM"],
  "Porsche": ["Boxster","Cayman","718 Cayman","718 Boxster","911","Panamera","Cayenne","Macan","Macan Electric","Taycan"],
  "MINI": ["Hatch","Cooper","Cooper 3 Door","Cooper 5 Door","Convertible","Clubman","Countryman","Cooper Electric"],
  "Tesla": ["Model 3","Model Y"],
  "VinFast": ["VF 6","VF 7","VF 8","VF 9"],
  "Aston Martin": ["Vantage","DB9","DB11","DB12","DBS","Rapide","DBX","Vanquish"],
  "Bentley": ["Continental GT","Continental Flying Spur","Flying Spur","Bentayga","Mulsanne"],
  "Ferrari": ["458 Italia","488 GTB","488 Spider","F8 Tributo","Roma","296 GTB","296 GTS","Purosangue","12Cilindri"],
  "Lamborghini": ["Gallardo","Huracan","Urus","Urus SE","Aventador","Revuelto","Temerario"],
  "Maserati": ["Ghibli","Quattroporte","GranTurismo","GranCabrio","Levante","Grecale"],
  "Rolls-Royce": ["Phantom","Ghost","Wraith","Dawn","Cullinan","Spectre"],
  "McLaren": ["570S","720S","GT","Artura","750S","GTS"],
  "Lotus": ["Elise","Exige","Evora","Emira","Eletre"]
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
