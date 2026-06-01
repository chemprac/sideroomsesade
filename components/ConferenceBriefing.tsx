'use client'

import Link from 'next/link'

type ConferenceBriefingProps = {
  eventSlug: string
  firstIcpId: string
}

export default function ConferenceBriefing({ eventSlug, firstIcpId }: ConferenceBriefingProps) {
  return (
    <div style={{background:'#F5F0E6',fontFamily:"'DM Sans',sans-serif",color:'#1C1208',width:'100%',border:'1px solid #C4B89A'}}>

      {/* TOP BAR */}
      <div style={{borderBottom:'1px solid #C4B89A',padding:'10px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#EDE5D0'}}>
        <div style={{display:'flex',flexDirection:'column',gap:2}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#8B7D5A',textTransform:'uppercase',letterSpacing:'0.08em'}}>Conference Intelligence Brief</span>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,color:'#1C1208'}}>ESADE Entrepreneurship Summit 2026</span>
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#8B7D5A',textTransform:'uppercase',letterSpacing:'0.08em'}}>Barcelona · May 28–30</span>
      </div>

      {/* STATS ROW */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',borderBottom:'1px solid #C4B89A'}}>
        {[
          {num:'182',label:'Attendees'},
          {num:'26',label:'Speakers'},
          {num:'34%',label:'Founders & CEOs'},
          {num:'19+',label:'Countries'},
        ].map((s,i,arr)=>(
          <div key={i} style={{padding:'16px 18px',borderRight:i<arr.length-1?'1px solid #C4B89A':'none'}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:600,color:'#1C1208',lineHeight:1}}>{s.num}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',color:'#8B7D5A',marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderBottom:'1px solid #C4B89A'}}>
        
        {/* Donut */}
        <div style={{padding:'16px 18px',borderRight:'1px solid #C4B89A'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#C4842A',marginBottom:10}}>Who's in the room</div>
          <svg width="150" height="150" viewBox="0 0 150 150" style={{display:'block',margin:'0 auto 10px'}} role="img" aria-label="Attendee mix: Founders and CEOs 26%, Investors and VCs 14%, Senior Executives 22%, MBA Students 26%, Other 12%">
            <circle cx="75" cy="75" r="48" fill="none" stroke="#C4842A" strokeWidth="18" strokeDasharray="78.4 223.2" strokeDashoffset="0" transform="rotate(-90 75 75)"/>
            <circle cx="75" cy="75" r="48" fill="none" stroke="#1C1208" strokeWidth="18" strokeDasharray="42.2 259.4" strokeDashoffset="-78.4" transform="rotate(-90 75 75)"/>
            <circle cx="75" cy="75" r="48" fill="none" stroke="#8B7D5A" strokeWidth="18" strokeDasharray="66.4 235.2" strokeDashoffset="-120.6" transform="rotate(-90 75 75)"/>
            <circle cx="75" cy="75" r="48" fill="none" stroke="#EDE5D0" strokeWidth="18" strokeDasharray="78.4 223.2" strokeDashoffset="-187.0" transform="rotate(-90 75 75)"/>
            <circle cx="75" cy="75" r="48" fill="none" stroke="#C4B89A" strokeWidth="18" strokeDasharray="36.2 265.4" strokeDashoffset="-265.4" transform="rotate(-90 75 75)"/>
            <circle cx="75" cy="75" r="34" fill="#F5F0E6"/>
            <text x="75" y="71" textAnchor="middle" fontFamily="Playfair Display,serif" fontSize="20" fontWeight="600" fill="#1C1208">182</text>
            <text x="75" y="84" textAnchor="middle" fontFamily="DM Mono,monospace" fontSize="8" fill="#8B7D5A">PEOPLE</text>
          </svg>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:6}}>
            {[
              {color:'#C4842A',label:'Founders / CEOs',pct:'26%',border:false},
              {color:'#1C1208',label:'Investors / VCs',pct:'14%',border:false},
              {color:'#8B7D5A',label:'Senior Executives',pct:'22%',border:false},
              {color:'#EDE5D0',label:'MBA Students',pct:'26%',border:true},
              {color:'#C4B89A',label:'Other',pct:'12%',border:false},
            ].map((l,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,fontSize:11,color:'#1C1208'}}>
                <span style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{width:8,height:8,flexShrink:0,background:l.color,border:l.border?'1px solid #C4B89A':'none'}}/>
                  <span>{l.label}</span>
                </span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#8B7D5A'}}>{l.pct}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Industry bars */}
        <div style={{padding:'16px 18px'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#C4842A',marginBottom:10}}>Top industries</div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {[
              {label:'Tech & SaaS',pct:31},
              {label:'Fintech & Banking',pct:22},
              {label:'Consulting & PE',pct:17},
              {label:'Deep Tech / Bio',pct:12},
              {label:'Impact & Climate',pct:9},
              {label:'Other',pct:9},
            ].map((b,i)=>(
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                  <span style={{color:'#1C1208'}}>{b.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",color:'#8B7D5A',fontSize:10}}>{b.pct}%</span>
                </div>
                <div style={{height:3,background:'#EDE5D0',width:'100%'}}>
                  <div style={{height:3,background:'#C4842A',width:`${b.pct}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SIGNALS */}
      <div style={{borderBottom:'1px solid #C4B89A',padding:'14px 18px'}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#C4842A',marginBottom:8}}>Intelligence signals</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {[
            {tag:'Fundraising',head:'VC activity is unusually concentrated',sub:'6 active GPs attending — mostly seed/Series A. Oriol Juncosa (Plus Partners) closing a new fund.'},
            {tag:'Hiring wave',head:'25% of companies actively hiring',sub:'Tech and fintech companies are scaling fast. Multiple CTO-level openings flagged across attendee companies.'},
            {tag:'Agenda intel',head:'Real action happens after Steve Blank',sub:'Closing keynote Day 2 (18:45) is the inflection point — conversations that follow tend to convert into intros.'},
          ].map((s,i)=>(
            <div key={i} style={{border:'1px solid #C4B89A',padding:'11px 13px',background:'#F5F0E6'}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,textTransform:'uppercase',letterSpacing:'0.06em',color:'#C4842A',marginBottom:5}}>{s.tag}</div>
              <div style={{fontSize:12,fontWeight:500,color:'#1C1208',marginBottom:3}}>{s.head}</div>
              <div style={{fontSize:11,color:'#8B7D5A',lineHeight:1.4}}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* DEAN NOTE + COMPANIES */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderBottom:'1px solid #C4B89A'}}>
        <div style={{padding:'16px 18px',borderRight:'1px solid #C4B89A'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#C4842A',marginBottom:10}}>Before you walk in</div>
          <p style={{fontSize:12,color:'#1C1208',lineHeight:1.6,marginBottom:10}}>This isn't a panel conference — it's a reunion with deal potential. The ESADE network runs deep, so warm intros from existing alumni carry disproportionate weight. <strong style={{fontWeight:500}}>Don't pitch cold.</strong></p>
          <p style={{fontSize:12,color:'#1C1208',lineHeight:1.6,marginBottom:10}}>Day 3 is a sailboat trip. That's your highest-value window — 4 hours, no agenda, no stage. The real conversations happen on the water.</p>
          <p style={{fontSize:12,color:'#8B7D5A',lineHeight:1.6}}>Leave with: 3 warm intros + 1 follow-up meeting booked before the boat docks.</p>
        </div>
        <div style={{padding:'16px 18px'}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#C4842A',marginBottom:10}}>Key companies in the room</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {[
              {name:'Plug and Play',type:'Accelerator'},
              {name:'Plus Partners',type:'Investor'},
              {name:'Suma Capital',type:'Investor'},
              {name:'Neuroelectrics',type:'Deep Tech'},
              {name:'allWomen',type:'Ed-Tech'},
              {name:'ISDI',type:'Partner'},
              {name:'Flywire',type:'Fintech'},
              {name:'Satellogic',type:'Deep Tech'},
            ].map((c,i)=>(
              <div key={i} style={{border:'1px solid #C4B89A',padding:'5px 9px',display:'flex',flexDirection:'column',gap:1}}>
                <span style={{fontSize:11,fontWeight:500,color:'#1C1208'}}>{c.name}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#8B7D5A',textTransform:'uppercase',letterSpacing:'0.05em'}}>{c.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div style={{padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,background:'#EDE5D0'}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#8B7D5A'}}>Matched to 182 attendees · AI-scored for your goal</span>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <Link
            href={`/${eventSlug}/companies?icp=${encodeURIComponent(firstIcpId)}`}
            style={{fontFamily:"'DM Mono',monospace",fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',background:'#1C1208',color:'#F5F0E6',border:'none',padding:'10px 22px',cursor:'pointer',textDecoration:'none',display:'inline-block',borderRadius:2}}
          >
            See matched companies →
          </Link>
          <Link
            href={`/${eventSlug}/people?icp=${encodeURIComponent(firstIcpId)}`}
            style={{fontFamily:"'DM Mono',monospace",fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',background:'transparent',color:'#1C1208',border:'1px solid #1C1208',padding:'10px 22px',cursor:'pointer',textDecoration:'none',display:'inline-block',borderRadius:2}}
          >
            See matched people →
          </Link>
        </div>
      </div>

    </div>
  )
}
