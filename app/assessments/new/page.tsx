"use client";

import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

const carModels: Record<string, string[]> = {"Maruti Suzuki":["800","Alto","Alto K10","Omni","Zen","Zen Estilo","Wagon R","A-Star","Celerio","S-Presso","Ritz","Ignis","Swift","Swift Dzire","Dzire","Baleno","Baleno RS","Fronx","Brezza","Vitara Brezza","S-Cross","Grand Vitara","Ertiga","XL6","Eeco","Versa","Gypsy","Gypsy King","Esteem","Baleno Sedan","SX4","Ciaz","Kizashi","Jimny","Invicto","Victoris","e Vitara"],"Hyundai":["Santro","Santro Xing","i10","Grand i10","Grand i10 Nios","Getz","Eon","i20","i20 Active","i20 N Line","Accent","Xcent","Aura","Verna","Sonata","Sonata Embera","Elantra","Terracan","Tucson","Santa Fe","Creta","Creta N Line","Creta Electric","Venue","Venue N Line","Exter","Alcazar","Kona Electric","Ioniq 5"],"Tata Motors":["Indica","Indica V2","Indica Vista","Indica EV","Indigo","Indigo Marina","Indigo CS","Indigo Manza","Estate","Sierra","Sumo","Sumo Gold","Safari","Safari Storme","Aria","Hexa","Nano","Bolt","Zest","Tiago","Tiago NRG","Tiago JTP","Tigor","Tigor JTP","Altroz","Altroz Racer","Punch","Punch EV","Nexon","Nexon EV","Curvv","Curvv EV","Harrier","Harrier EV","Safari","Sierra"],"Mahindra":["Armada","Marshal","Commander","Classic","Bolero","Bolero Invader","Bolero Camper","Bolero Neo","Bolero Neo Plus","Scorpio","Scorpio Classic","Scorpio N","Xylo","Quanto","NuvoSport","Verito","Logan","Thar","Thar Roxx","TUV300","KUV100","KUV100 NXT","XUV500","XUV300","XUV 3XO","XUV400","XUV700","Marazzo","Alturas G4","BE 6","XEV 9e","XUV 7XO"],"Toyota":["Qualis","Camry","Corolla","Corolla Altis","Prius","Etios","Etios Liva","Etios Cross","Yaris","Platinum Etios","Urban Cruiser","Urban Cruiser Taisor","Urban Cruiser Hyryder","Glanza","Rumion","Innova","Innova Crysta","Innova HyCross","Fortuner","Fortuner Legender","Hilux","Vellfire","Land Cruiser Prado","Land Cruiser 250","Land Cruiser 300","RAV4"],"Honda":["City","City ZX","Civic","Civic Hybrid","Accord","Accord Hybrid","CR-V","Brio","Amaze","Mobilio","Jazz","WR-V","BR-V","Elevate","City e:HEV"],"Kia":["Sonet","Seltos","Carens","Carens Clavis","Carnival","EV6","EV9"],"Ford":["Ikon","Fiesta","Fiesta Classic","Fusion","Mondeo","Endeavour","EcoSport","Figo","Figo Aspire","Aspire","Freestyle","Mustang"],"Chevrolet":["Spark","Matiz","Beat","Aveo","Aveo U-VA","Optra","Optra Magnum","Cruze","Sail","Sail Hatchback","Enjoy","Tavera","Captiva","Trailblazer"],"Fiat":["Uno","Siena","Palio","Palio Adventure","Palio Weekend","Petra","Punto","Grande Punto","Punto Evo","Linea","Linea Classic","Avventura","500","Bravo","Abarth Punto","Abarth 595"],"Renault":["Logan","Pulse","Fluence","Koleos","Scala","Duster","Lodgy","Captur","Kwid","Triber","Kiger","Arkana"],"Nissan":["Micra","Micra Active","Sunny","Teana","X-Trail","Terrano","Evalia","Kicks","Magnite"],"Datsun":["Go","Go+","redi-GO"],"Mitsubishi":["Lancer","Lancer Cedia","Cedia","Pajero","Pajero Sport","Montero","Outlander","Carisma"],"Skoda":["Octavia","Octavia RS","Fabia","Laura","Rapid","Rapid Monte Carlo","Yeti","Superb","Kushaq","Slavia","Kylaq","Kodiaq"],"Volkswagen":["Polo","Polo GT","Polo GT TSI","Vento","Ameo","Jetta","Passat","Beetle","Touareg","Tiguan","Virtus","Taigun"],"MG Motor":["ZS EV","Hector","Hector Plus","Gloster","Astor","Comet EV","Windsor EV","Cyberster","Majestor"],"Jeep":["Compass","Meridian","Wrangler","Grand Cherokee","Avenger"],"Citroën":["C3","eC3","C3 Aircross","C3 Aircross X","Basalt"],"BYD":["e6","Atto 3","Seal","Sealion 7"],"Isuzu":["D-Max","V-Cross","MU-7","MU-X"],"Force Motors":["Gurkha","Gurkha 3 Door","Gurkha 5 Door","Trax Cruiser","Trax Toofan"],"SsangYong":["Rexton","Rexton W","Rodius","Korando"],"Opel":["Astra","Astra 1.6","Corsa","Corsa Sail","Corsa Swing","Vectra"],"Daewoo":["Cielo","Matiz","Nubira","Espero"],"Hindustan Motors":["Ambassador","Contessa"],"Premier":["Padmini","118 NE","Rio"],"BMW":["3 Series","5 Series","7 Series","1 Series","2 Series Gran Coupe","6 Series","8 Series","X1","X3","X5","X6","X7","XM","Z4","i4","i5","i7","i8","iX","iX1"],"Mercedes-Benz":["A-Class","A-Class Limousine","B-Class","C-Class","E-Class","S-Class","CLA","CLS","GLA","GLB","GLC","GLK","GLE","GLS","M-Class","G-Class","V-Class","EQA","EQB","EQE","EQS","Maybach GLS","Maybach S-Class"],"Audi":["A3","A4","A5","A6","A7","A8","A8 L","Q2","Q3","Q3 Sportback","Q5","Q7","Q8","R8","TT","S5 Sportback","RS5","RS7","RS Q8","e-tron","Q8 e-tron","e-tron GT"],"Volvo":["S40","S60","S80","S90","V40","V40 Cross Country","V90 Cross Country","XC40","XC40 Recharge","XC60","XC90","C30","C40 Recharge","EC40","EX30"],"Jaguar":["X-Type","XF","XJ","XE","F-Pace","F-Type","I-Pace"],"Land Rover":["Freelander","Freelander 2","Range Rover","Range Rover Sport","Range Rover Evoque","Range Rover Velar","Discovery","Discovery 3","Discovery 4","Discovery Sport","Defender"],"Lexus":["ES","IS","NX","RX","LX","LC","LM"],"Porsche":["Boxster","Cayman","718 Cayman","718 Boxster","911","Panamera","Cayenne","Macan","Macan Electric","Taycan"],"MINI":["Hatch","Cooper","Cooper 3 Door","Cooper 5 Door","Convertible","Clubman","Countryman","Cooper Electric"],"Tesla":["Model 3","Model Y"],"VinFast":["VF 6","VF 7","VF 8","VF 9"],"Aston Martin":["Vantage","DB9","DB11","DB12","DBS","Rapide","DBX","Vanquish"],"Bentley":["Continental GT","Continental Flying Spur","Flying Spur","Bentayga","Mulsanne"],"Ferrari":["458 Italia","488 GTB","488 Spider","F8 Tributo","Roma","296 GTB","296 GTS","Purosangue","12Cilindri"],"Lamborghini":["Gallardo","Huracan","Urus","Urus SE","Aventador","Revuelto","Temerario"],"Maserati":["Ghibli","Quattroporte","GranTurismo","GranCabrio","Levante","Grecale"],"Rolls-Royce":["Phantom","Ghost","Wraith","Dawn","Cullinan","Spectre"],"McLaren":["570S","720S","GT","Artura","750S","GTS"],"Lotus":["Elise","Exige","Evora","Emira","Eletre"]};

const makes = Object.keys(carModels);
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);\nconst MAX_IMAGE_DIMENSION = 3200;\nconst JPEG_QUALITY = 0.82;\n\nasync function preparePhoto(file: File): Promise<File> {\n  if(!ACCEPTED_PHOTO_TYPES.has(file.type)) throw new Error(`${file.name} is not supported. Use JPG, PNG or WebP.`);\n  if(file.size>MAX_PHOTO_BYTES) throw new Error(`${file.name} is larger than 10 MB. Please choose a smaller photo.`);\n\n  let bitmap: ImageBitmap;\n  try { bitmap = await createImageBitmap(file); } catch { throw new Error(`${file.name} could not be read as a valid image. Please choose another photo.`); }\n  try {\n    if(bitmap.width<1 || bitmap.height<1) throw new Error(`${file.name} is not a valid image.`);\n    const scale=Math.min(1,MAX_IMAGE_DIMENSION/Math.max(bitmap.width,bitmap.height));\n    const width=Math.max(1,Math.round(bitmap.width*scale));\n    const height=Math.max(1,Math.round(bitmap.height*scale));\n    const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height;\n    const context=canvas.getContext("2d"); if(!context) throw new Error("This browser could not prepare the photo.");\n    context.drawImage(bitmap,0,0,width,height);\n    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",JPEG_QUALITY));\n    if(!blob) throw new Error(`${file.name} could not be prepared for upload.`);\n    if(blob.size>MAX_PHOTO_BYTES) throw new Error(`${file.name} is still too large after preparation. Please choose a smaller photo.`);\n    const base=file.name.replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9._-]/g,"_") || "damage-photo";\n    return new File([blob],`${base}.jpg`,{type:"image/jpeg",lastModified:file.lastModified});\n  } finally { bitmap.close(); }\n}

export default function NewAssessmentPage() {
  const [make,setMake]=useState("");
  const [model,setModel]=useState("");
  const [locationStatus,setLocationStatus]=useState("Getting your current location…");
  const [coords,setCoords]=useState<{latitude:number;longitude:number;accuracy:number}|null>(null);
  const [locationDetails,setLocationDetails]=useState<{address:string;city:string;state:string;pincode:string;country:string}>({address:"",city:"",state:"",pincode:"",country:""});
  const [photos,setPhotos]=useState<File[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const supabase=createClient();

  function addPhotos(list: FileList|null){
    if(!list)return;
    const incoming=Array.from(list);
    const invalidType=incoming.find(file=>!ACCEPTED_PHOTO_TYPES.has(file.type));
    if(invalidType){setMessage(`${invalidType.name} is not supported. Use JPG, PNG or WebP.`);return;}
    const oversized=incoming.find(file=>file.size>MAX_PHOTO_BYTES);
    if(oversized){setMessage(`${oversized.name} is larger than 10 MB. Please choose a smaller photo.`);return;}
    const next=[...photos,...incoming].filter((f,i,a)=>i===a.findIndex(x=>x.name===f.name&&x.size===f.size));
    setPhotos(next.slice(0,MAX_PHOTOS));
    setMessage(next.length>MAX_PHOTOS?`Only the first ${MAX_PHOTOS} photos were added.`:"");
  }

  function removePhoto(index:number){
    setPhotos(current=>current.filter((_,photoIndex)=>photoIndex!==index));
    if(input.current) input.current.value="";
  }

  function getCurrentLocation(){
    if(!navigator.geolocation){
      setLocationStatus("GPS is not supported by this browser.");
      return;
    }
    setLocationStatus("Getting your current GPS location…");
    navigator.geolocation.getCurrentPosition(
      position=>{
        const next={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};
        setCoords(next);
        setLocationStatus(`GPS location captured (accuracy ~${Math.round(next.accuracy)} m). Looking up address…`);
        fetch(`/api/reverse-geocode?latitude=${encodeURIComponent(next.latitude)}&longitude=${encodeURIComponent(next.longitude)}`)
          .then(response=>{if(!response.ok){console.warn("CarFix reverse geocode failed",{status:response.status,statusText:response.statusText});throw new Error(`Reverse geocoding failed (${response.status})`);}return response.json();})
          .then(data=>{
            const details={
              address:data.locality || data.localityInfo?.informative?.[0]?.name || "",
              city:data.city || data.locality || "",
              state:data.principalSubdivision || "",
              pincode:data.postcode || "",
              country:data.countryName || ""
            };
            setLocationDetails(details);
            setLocationStatus(`Location captured${details.city ? ` — ${details.city}` : ""} (accuracy ~${Math.round(next.accuracy)} m).`);
          })
          .catch(error=>{console.warn("CarFix reverse geocode unavailable",{message:error instanceof Error ? error.message : "Unknown lookup error"});setLocationStatus(`GPS location captured (accuracy ~${Math.round(next.accuracy)} m). Address lookup unavailable.`);});
      },
      error=>{
        setCoords(null);
        setLocationStatus(
          error.code===error.PERMISSION_DENIED
            ? "Location permission was denied. Please allow location access to continue."
            : "Could not get your location. Please try again."
        );
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    );
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!make || !model){setMessage("Please select the car make and model.");return;}
    if(!photos.length){setMessage("Please add at least one damage photo.");return;}
    if(!coords){setMessage("Please allow location access so we can capture your current GPS location.");getCurrentLocation();return;}
    if(!consent){setMessage("Please confirm the assessment consent before continuing.");return;}
    setBusy(true);
    setMessage("Saving assessment…");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return;}

    const {data:vehicle,error:ve}=await supabase.from("vehicles")
      .insert({user_id:user.id,make,model,year:null,registration_number:null})
      .select("id").single();

    if(ve){setBusy(false);setMessage("Could not save your vehicle details. Please try again.");return;}

    const {data:assessment,error:ae}=await supabase.from("assessments")
      .insert({user_id:user.id,vehicle_id:vehicle.id,city:locationDetails.city || locationDetails.address || "Current location",latitude:coords.latitude,longitude:coords.longitude,gps_accuracy:coords.accuracy,location_captured_at:new Date().toISOString(),address:locationDetails.address || null,state:locationDetails.state || null,pincode:locationDetails.pincode || null,country:locationDetails.country || null,status:"pending"})
      .select("id").single();

    if(ae){setBusy(false);setMessage("Could not create your assessment. Please try again.");return;}

    const uploadedPaths:string[]=[];
    try{
      let uploaded=0;
      for(let start=0;start<photos.length;start+=3){
        const batch=photos.slice(start,start+3);
        await Promise.all(batch.map(async file=>{
          const path=`${user.id}/${assessment.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
          const {error:uploadError}=await supabase.storage.from("carfix-damage-photos")
            .upload(path,file,{contentType:file.type,upsert:false});
          if(uploadError)throw new Error(uploadError.message);
          uploadedPaths.push(path);
          uploaded+=1;
          setMessage(`Uploading photos… ${uploaded} of ${photos.length}`);
        }));
      }

      const {error:photoError}=await supabase.from("assessment_photos").insert(
        uploadedPaths.map(storage_path=>({assessment_id:assessment.id,storage_path,photo_type:"damage"}))
      );
      if(photoError)throw new Error(photoError.message);
    }catch{
      if(uploadedPaths.length)await supabase.storage.from("carfix-damage-photos").remove(uploadedPaths);
      setBusy(false);
      setMessage("Could not upload your photos. Please check your connection and try again.");
      return;
    }

    window.location.href=`/assessments/${assessment.id}`;
  }

  return <main className="assessment-new-page">
    <header className="nav"><div className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><a className="brand" href="/"><span>Car</span>Fix.</a><a className="btn" href="/dashboard">Dashboard</a></div></header>
    <section className="section"><div className="container" style={{maxWidth:900}}>
      <div className="assessment-progress"><span className="active">01</span><i></i><span>02</span><i></i><span>03</span><label>Vehicle</label><label>Photos</label><label>AI report</label></div>
      <div className="assessment-new-heading"><div><div className="home-kicker">NEW ASSESSMENT</div><h1>Let's inspect your car.</h1><p className="muted">A few details and clear photos are all CarFix needs to create your preliminary body repair assessment.</p></div><div className="assessment-badge">✦ AI powered</div></div>
      <form onSubmit={submit} className="new-assessment-grid">
        <div className="card new-assessment-main">
          <div className="form-section-title"><span>01</span><div><h2>Your vehicle</h2><p className="muted">Select the vehicle you want to inspect.</p></div></div>
          <div className="grid" style={{gridTemplateColumns:"1fr 1fr"}}>
            <select value={make} onChange={e=>{setMake(e.target.value);setModel("");}} required><option value="">Select car make</option>{makes.map(item=><option key={item} value={item}>{item}</option>)}</select>
            <select value={model} onChange={e=>setModel(e.target.value)} required disabled={!make}><option value="">{make?"Select car model":"Select make first"}</option>{(carModels[make]??[]).map(item=><option key={item} value={item}>{item}</option>)}</select>
          </div>
          <div className="form-section-title" style={{marginTop:34}}><span>02</span><div><h2>Current location</h2><p className="muted">We'll securely capture your GPS location for this assessment.</p></div></div>
          <div className={`location-card ${coords?"captured":""}`}><div className="location-icon">⌖</div><div><strong>{coords?"Location captured":"Location required"}</strong><p>{locationStatus}</p>{coords&&locationDetails.address&&<small>{locationDetails.address}{locationDetails.city?`, ${locationDetails.city}`:""}{locationDetails.state?`, ${locationDetails.state}`:""}{locationDetails.pincode?` — ${locationDetails.pincode}`:""}</small>}</div>{!coords&&<button type="button" className="btn" onClick={getCurrentLocation}>Use my location</button>}</div>
          <div className="form-section-title" style={{marginTop:34}}><span>03</span><div><h2>Damage photos</h2><p className="muted">Use different angles. Up to 10 clear photos.</p></div></div>
          <div className="photo-drop" onClick={()=>input.current?.click()} role="button" tabIndex={0} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();input.current?.click();}}}><div className="upload-icon">↑</div><strong>Upload damage photos</strong><span>JPG, PNG or WebP · Maximum 10 MB each · Large images are optimized before upload</span><button type="button" className="btn" onClick={(e)=>{e.stopPropagation();input.current?.click()}}>Choose photos</button><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{void addPhotos(e.target.files)}}/></div>
          {photos.length>0&&<div className="photo-list">{photos.map((p,i)=><div key={`${p.name}-${p.size}`}><span>✓</span><strong>{p.name}</strong><small>{(p.size/1024/1024).toFixed(1)} MB</small><button type="button" onClick={()=>removePhoto(i)} aria-label={`Remove ${p.name}`}>Remove</button></div>)}</div>}
          {message&&<div className="form-message" role="status" aria-live="polite">{message}</div>}
        </div>
        <aside className="assessment-side"><div className="card side-card"><div className="home-kicker">WHAT YOU'LL GET</div><h3>One clear report.</h3><ul><li><b>AI damage summary</b><span>Visible body damage identified from your photos.</span></li><li><b>Repair guidance</b><span>Repair, repaint, blend or replacement recommendations.</span></li><li><b>Cost range</b><span>Preliminary Indian-market body repair estimate.</span></li><li><b>Repair time</b><span>Estimated workshop time for the visible work.</span></li></ul><button className="home-primary-btn" disabled={busy} type="submit" style={{width:"100%",border:0,marginTop:12}}>{busy?"Creating assessment…":"Create assessment →"}</button><label style={{display:"flex",gap:10,alignItems:"flex-start",marginTop:16,fontSize:14,lineHeight:1.45}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required style={{width:"auto",marginTop:3}}/><span>I confirm I am authorized to upload these vehicle photos and details, and I consent to CarFix processing the submitted photos and location information to provide this assessment.</span></label><small className="muted" style={{display:"block",textAlign:"center",marginTop:12}}>Your photos stay securely in CarFix.</small></div></aside>
      </form>
    </div></section>
  </main>;
}
