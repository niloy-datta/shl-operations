"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function PasswordForm() {
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const router=useRouter();
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError("");
    const form=new FormData(event.currentTarget);
    const currentPassword=String(form.get("current")??"");
    const newPassword=String(form.get("new")??"");
    const confirm=String(form.get("confirm")??"");
    if(newPassword.length<16 || newPassword.length>128) {
      setError("Use a new password of 16–128 characters.");return;
    }
    if(newPassword!==confirm){setError("New passwords do not match.");return;}
    setBusy(true);
    try {
      const res=await fetch("/api/enterprise/staff/password",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({currentPassword,newPassword})
      });
      if(!res.ok){setError(res.status===400?"Current password is incorrect or new password is invalid.":"Unable to update password.");return;}
      await fetch("/api/auth/logout",{method:"POST"});
      router.replace("/login");
      router.refresh();
    }catch{setError("Unable to reach the service.");}
    finally{setBusy(false);}
  }
  return <form className="en-form" onSubmit={submit} style={{maxWidth:600}}>
    <label className="en-field"><span>Current password</span>
      <input type="password" name="current" autoComplete="current-password" required /></label>
    <label className="en-field"><span>New password · 16 characters minimum</span>
      <input type="password" name="new" autoComplete="new-password" required minLength={16} maxLength={128}/></label>
    <label className="en-field"><span>Confirm new password</span>
      <input type="password" name="confirm" autoComplete="new-password" required/></label>
    {error&&<div className="en-alert" role="alert">{error}</div>}
    <button className="en-primary" type="submit" disabled={busy}>{busy?"Updating…":"Change password and sign out →"}</button>
  </form>;
}
