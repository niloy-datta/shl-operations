import type {ReactNode} from "react";

/**
 * Small dependency-free UI primitives. Reuse everywhere in the operations
 * workspace instead of recreating metric/empty/error styles per module.
 */
export function StatCard({label,value,detail,icon,loading=false}:{
  label:string;value:number|null;detail:string;icon?:ReactNode;loading?:boolean
}){
  return <article className="os-stat-card" aria-busy={loading}>
    <div className="os-stat-header"><span>{label}</span>
      {icon&&<span className="os-stat-icon" aria-hidden="true">{icon}</span>}</div>
    <strong aria-live="polite">{loading||value===null?"—":value.toLocaleString("en-US")}</strong>
    <p>{detail}</p>
  </article>;
}

export function EmptyState({title,description,action,icon}:{
  title:string;description:string;action?:ReactNode;icon?:ReactNode
}){
  return <div className="os-empty-state">
    {icon&&<div className="os-empty-icon" aria-hidden="true">{icon}</div>}
    <h3>{title}</h3><p>{description}</p>{action&&<div className="os-empty-action">{action}</div>}
  </div>;
}

export function FeedbackNotice({message,kind="error",action}:{
  message:string;kind?:"error"|"success"|"info";action?:ReactNode
}){
  return <div className="os-feedback" role={kind==="error"?"alert":"status"}
    data-kind={kind}><span>{message}</span>{action}</div>;
}
