"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {usePathname,useRouter} from "next/navigation";
import {navigationMatches,visibleNavigation,type NavModule} from "@/lib/operations-navigation";

type Staff={username:string;role:string};

/**
 * Global Ctrl/Cmd+K module finder. No saved search history or third-party data.
 * Navigation visibility is presentation-only; API access is enforced separately.
 */
export function OperationsCommand(){
  const path=usePathname();
  const router=useRouter();
  const inWorkspace=path.startsWith("/workspace") && !path.startsWith("/workspace/account/enroll-mfa");
  const [staff,setStaff]=useState<Staff|null>(null);
  const [commissionAccess,setCommissionAccess]=useState(false);
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [cursor,setCursor]=useState(0);
  const inputRef=useRef<HTMLInputElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const dialogRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!inWorkspace)return;
    let active=true;
    fetch("/api/data/me",{cache:"no-store"})
      .then(async res=>res.ok?await res.json() as Staff:null)
      .then(user=>{if(active)setStaff(user);})
      .catch(()=>{if(active)setStaff(null);});
    fetch("/api/costs/commissions/access",{cache:"no-store"})
      .then(async res=>res.ok?await res.json() as {allowed?:boolean}:null)
      .then(x=>{if(active)setCommissionAccess(x?.allowed===true);})
      .catch(()=>{if(active)setCommissionAccess(false);});
    return()=>{active=false;};
  },[inWorkspace]);

  const groups=useMemo(()=>
    visibleNavigation(staff?.role,commissionAccess).map(group=>({
      ...group,items:group.items.filter(item=>navigationMatches(item,query))
    })).filter(group=>group.items.length>0),
    [staff?.role,commissionAccess,query]);
  const entries=useMemo(()=>groups.flatMap(group=>group.items),[groups]);

  const show=useCallback(()=>{
    if(!inWorkspace||!staff)return;
    setQuery("");setCursor(0);setOpen(true);
  },[inWorkspace,staff]);

  useEffect(()=>{
    if(!inWorkspace||!staff)return;
    function key(e:KeyboardEvent){
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
        e.preventDefault();
        setOpen(wasOpen=>!wasOpen);
      }
    }
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  },[inWorkspace,staff]);
  useEffect(()=>{
    if(!open)return;
    const id=window.requestAnimationFrame(()=>inputRef.current?.focus());
    return()=>window.cancelAnimationFrame(id);
  },[open]);

  const close=useCallback(()=>{
    setOpen(false);
    window.requestAnimationFrame(()=>triggerRef.current?.focus());
  },[]);

  function go(item:NavModule){
    setOpen(false);
    router.push(item.href);
  }
  function keys(e:React.KeyboardEvent<HTMLDivElement>){
    if(e.key==="Escape"){e.preventDefault();close();return;}
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){
      e.preventDefault();
      setCursor(current=>{
        const safe=Math.min(current,Math.max(0,entries.length-1));
        return entries.length===0?0:
          (safe+(e.key==="ArrowDown"?1:entries.length-1))%entries.length;
      });
      return;
    }
    if(e.key==="Enter"&&entries.length){
      e.preventDefault();
      go(entries[Math.min(cursor,entries.length-1)]);
      return;
    }
    if(e.key==="Tab"&&dialogRef.current){
      const elements=Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),a[href]'
      ));
      if(!elements.length)return;
      const first=elements[0],last=elements[elements.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  }

  if(!inWorkspace||!staff)return null;
  let nextIndex=0;
  return <>
    <button type="button" className="os-command-launcher" ref={triggerRef}
      onClick={show} aria-haspopup="dialog" aria-expanded={open}
      aria-controls="os-command-dialog" title="Search modules (Ctrl or Cmd + K)">
      <span aria-hidden="true" className="os-command-glyph">⌕</span>
      <span>Jump to anything</span><kbd>⌘ K</kbd>
    </button>
    {open&&<div className="os-command-backdrop" onMouseDown={e=>{
      if(e.target===e.currentTarget)close();
    }}>
      <div className="os-command-dialog" id="os-command-dialog" ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="os-command-title"
        onKeyDown={keys}>
        <div className="os-command-heading">
          <div><span className="os-command-eyebrow">QUICK NAVIGATION</span>
            <h2 id="os-command-title">Where to, {staff.username}?</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close search">✕</button>
        </div>
        <div className="os-command-search">
          <span aria-hidden="true">⌕</span>
          <input ref={inputRef} type="search" role="combobox" aria-autocomplete="list"
            aria-expanded="true" aria-controls="os-command-results"
            aria-activedescendant={entries.length?"os-command-item-"+Math.min(cursor,entries.length-1):undefined}
            value={query} onChange={e=>{setQuery(e.target.value);setCursor(0);}}
            placeholder="Search modules, RFQs, shipments, finance…" aria-label="Search navigation modules"/>
          <kbd>ESC</kbd>
        </div>
        <div className="os-command-results" role="listbox" id="os-command-results"
          aria-label="Available modules">
          {groups.map(group=><div key={group.label} className="os-command-group">
            <div className="os-command-group-label">{group.label}</div>
            {group.items.map(item=>{
              const position=nextIndex++;
              return <button type="button" key={item.href} role="option"
                id={"os-command-item-"+position} aria-selected={cursor===position}
                className={"os-command-result"+(cursor===position?" is-selected":"")}
                onMouseEnter={()=>setCursor(position)} onClick={()=>go(item)}>
                <span className="os-command-symbol" aria-hidden="true">{item.symbol}</span>
                <span className="os-command-description"><strong>{item.label}</strong>
                  <small>{item.description}</small></span>
                <span aria-hidden="true" className="os-command-arrow">↗</span>
              </button>;
            })}
          </div>)}
          {!entries.length&&<div className="os-command-empty">
            <span aria-hidden="true">⌕</span><strong>No matching module</strong>
            <p>Try “RFQ”, “shipping”, “team” or another workflow name.</p>
          </div>}
        </div>
        <div className="os-command-footer"><span>↑ ↓ Navigate</span><span>↵ Open</span>
          <span>Esc Close</span><span className="os-command-foot-right">SHL Operations OS</span></div>
      </div>
    </div>}
  </>;
}
