import {CalendarDays,Ship,PackageCheck,CheckCircle2} from "lucide-react";
type Event={event:string;occurred_at:string};
const date=(value:string|null|undefined)=>value?new Date(value.length===10?value+"T12:00:00Z":value).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}):"Not recorded";
export function ShipmentTimeline({etd,eta,events}:{etd:string|null;eta:string|null;events:Event[]}){
 const departed=events.find(event=>event.event==="IN_TRANSIT"),arrived=events.find(event=>event.event==="DELIVERED");
 const steps=[{label:"Estimated departure",value:etd,icon:CalendarDays},{label:"Departure reported",value:departed?.occurred_at,icon:Ship},{label:"Estimated arrival",value:eta,icon:CalendarDays},{label:"Delivery reported",value:arrived?.occurred_at,icon:PackageCheck}];
 return <section className="nx-shipment-timeline" aria-label="Shipment milestone timeline"><ol>{steps.map(step=><li key={step.label} data-recorded={!!step.value}><span><step.icon size={17}/></span><strong>{step.label}</strong><small>{date(step.value)}</small></li>)}</ol><p><CheckCircle2 size={13}/> Departure/delivery use staff report timestamps, not independently verified ATD/ATA or carrier telemetry.</p></section>;
}
