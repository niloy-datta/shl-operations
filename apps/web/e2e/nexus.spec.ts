import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {apiFor,json,useRole,unique,noPageOverflow} from "./support";

test("Nexus quick create, profile drawer and persisted theme use existing directory APIs",async({page})=>{
 await useRole(page);await page.goto("/workspace");await expect(page.getByRole("button",{name:"Switch to dark theme"})).toBeVisible();
 await page.getByRole("button",{name:"Switch to dark theme"}).click();await page.reload();
 await expect(page.locator(".nx-shell")).toHaveAttribute("data-nexus-theme","dark");
 await page.getByRole("button",{name:"Switch to light theme"}).click();
 await page.locator(".nx-create summary").click();await page.locator(".nx-create").getByRole("link",{name:"Customer",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Add customer"});await expect(dialog).toBeVisible();
 const name=unique("Nexus customer");await dialog.getByLabel("Name *",{exact:true}).fill(name);await dialog.getByRole("button",{name:"Create record"}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole("textbox",{name:"Search customers"}).fill(name);await page.getByRole("button",{name:"Search",exact:true}).click();
 const opener=page.getByRole("button",{name:"Open "+name+" profile"});await opener.click();
 const profile=page.getByRole("dialog",{name:name+" profile"});await expect(profile.getByRole("heading",{name})).toBeVisible();
 await page.keyboard.press("Escape");await expect(profile).toHaveCount(0);await expect(opener).toBeFocused();await noPageOverflow(page);
 await page.locator(".nx-create summary").click();await page.locator(".nx-create").getByRole("link",{name:"Customer",exact:true}).click();await expect(dialog).toBeVisible();await page.keyboard.press("Escape");
});

test("CSV import previews mapping and excludes invalid or duplicate rows before explicit save",async({page})=>{
 const api=await apiFor();const existing=unique("existing company"),fresh=unique("imported company");
 await json(api,"/api/data/customers","POST",{name:existing,country:"BD"});
 await useRole(page);await page.goto("/workspace?view=customers");await page.getByRole("button",{name:"Import CSV"}).click();
 const dialog=page.getByRole("dialog",{name:"Review CSV import"});
 await dialog.getByLabel("Choose CSV file").setInputFiles({name:"review.csv",mimeType:"text/csv",buffer:Buffer.from('Company,EmailAddress,Country\n"'+fresh+'",buyer@example.test,BD\nInvalid,bad-email,CN\n'+existing+',existing@example.test,BD\n"'+fresh+'",duplicate@example.test,BD')});
 await dialog.getByLabel("Map name").selectOption("0");await dialog.getByLabel("Map email").selectOption("1");await dialog.getByLabel("Map country").selectOption("2");
 expect((await json<{totalElements:number}>(api,"/api/data/customers?q="+encodeURIComponent(fresh))).totalElements).toBe(0);
 await dialog.getByRole("button",{name:"Validate against existing directory"}).click();
 await expect(dialog.getByRole("status")).toContainText("1 ready · 3 excluded · 0 saved");
 await expect(dialog.getByRole("button",{name:"Save reviewed records"})).toBeDisabled();
 await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"Save reviewed records"}).click();
 await expect(dialog.getByRole("status")).toContainText("1 saved");
 expect((await json<{totalElements:number}>(api,"/api/data/customers?q="+encodeURIComponent(fresh))).totalElements).toBe(1);
 await api.dispose();
});

test("six Nexus review routes support light and dark without overflow or serious accessibility failures",async({page},testInfo)=>{
 test.setTimeout(180_000);await useRole(page);
 const routes=[['my-day','/workspace','/api/workspace-overview'],['executive','/workspace/command-center','/api/workspace-overview'],['crm','/workspace?view=customers','/api/data/customers?'],['suppliers','/workspace?view=suppliers','/api/data/suppliers?'],['trading','/workspace/rfqs','/api/trading/rfqs?'],['logistics','/workspace/shipments/line','/api/enterprise/logistics/line-shipments?']];
 for(const [name,path,endpoint] of routes){
  const loaded=page.waitForResponse(r=>r.url().includes(endpoint)&&r.ok());await page.goto(path);await loaded;
  await expect(page.locator("h1")).toBeVisible();await expect(page.getByRole("button",{name:"Jump to anything"})).toBeVisible();
  for(const theme of ['light','dark']){
   if(await page.getByRole("button",{name:'Switch to '+theme+' theme'}).isVisible())await page.getByRole("button",{name:'Switch to '+theme+' theme'}).click();
   await expect(page.locator(".nx-shell")).toHaveAttribute("data-nexus-theme",theme);await noPageOverflow(page);
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   await testInfo.attach(name+'-'+theme+'.png',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
   await testInfo.attach(name+'-'+theme+'-axe.json',{body:JSON.stringify(result.violations),contentType:'application/json'});
   expect(result.violations.filter(v=>['critical','serious'].includes(v.impact||'')),name+' '+theme).toEqual([]);
  }
 }
});

test("My Day unavailable data remains unavailable until a real retry succeeds",async({page})=>{
 await useRole(page);await page.route("**/api/workspace-overview?scope=personal",route=>route.fulfill({status:503,contentType:"application/json",body:'{"error":"Synthetic outage"}'}));
 await page.goto("/workspace");await expect(page.getByRole("alert").filter({hasText:/unavailable/})).toBeVisible();
 await expect(page.getByText("No active shipments in this view",{exact:true})).toHaveCount(0);
 await expect(page.getByText("Shipment data unavailable",{exact:true})).toBeVisible();
 await page.unroute("**/api/workspace-overview?scope=personal");await page.getByRole("button",{name:"Retry overview"}).click();
 await expect(page.getByRole("alert").filter({hasText:/\S/})).toHaveCount(0);await expect(page.locator(".nx-kpi strong").first()).not.toHaveText("—");
});
