import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {accounts,apiFor,json,useRole,unique,noPageOverflow} from "./support";

test("Nexus quick create, profile drawer and persisted theme use existing directory APIs",async({page},testInfo)=>{
 await useRole(page);await page.goto("/workspace");await expect(page.getByRole("button",{name:"Switch to dark theme"})).toBeVisible();
 await page.getByRole("button",{name:"Switch to dark theme"}).click();await page.reload();
 await expect(page.locator(".nx-shell")).toHaveAttribute("data-nexus-theme","dark");
 const menu=page.getByRole("button",{name:"Workspace modules"});if(await menu.isVisible()){await menu.click();await expect(page.getByRole("navigation",{name:"Business modules"})).toBeVisible();await page.keyboard.press("Escape");await expect(menu).toBeFocused();await expect(page.getByRole("navigation",{name:"Business modules"})).toHaveCount(0);}
 await page.getByRole("button",{name:"Switch to light theme"}).click();
 await page.locator(".nx-create summary").click();await page.locator(".nx-create").getByRole("link",{name:"Customer",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Add customer"});await expect(dialog).toBeVisible();
 const name=unique("Nexus customer");await dialog.getByLabel("Name *",{exact:true}).fill(name);await dialog.getByRole("button",{name:"Create record"}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole("textbox",{name:"Search customers"}).fill(name);await page.getByRole("button",{name:"Search",exact:true}).click();
 const opener=page.getByRole("button",{name:"Open "+name+" profile"});await opener.click();
 const profile=page.getByRole("dialog",{name:name+" profile"});await expect(profile.getByRole("heading",{name})).toBeVisible();
 await testInfo.attach("crm-profile.png",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 await page.keyboard.press("Escape");await expect(profile).toHaveCount(0);await expect(opener).toBeFocused();await noPageOverflow(page);
 await page.locator(".nx-create summary").click();await page.locator(".nx-create").getByRole("link",{name:"Customer",exact:true}).click();await expect(dialog).toBeVisible();await page.keyboard.press("Escape");
});

test("CSV import previews mapping and excludes invalid or duplicate rows before explicit save",async({page},testInfo)=>{
 const api=await apiFor();const existing=unique("existing company"),fresh=unique("imported company");
 await json(api,"/api/data/customers","POST",{name:existing,country:"BD"});
 await useRole(page);await page.goto("/workspace?view=customers");await page.getByRole("button",{name:"Import CSV"}).click();
 const dialog=page.getByRole("dialog",{name:"Review CSV import"});
 await dialog.getByLabel("Choose CSV file").setInputFiles({name:"review.csv",mimeType:"text/csv",buffer:Buffer.from('Company,EmailAddress,Country\n"'+fresh+'",buyer@example.test,BD\nInvalid,bad-email,CN\n'+existing+',existing@example.test,BD\n"'+fresh+'",duplicate@example.test,BD')});
 await dialog.getByLabel("Map name").selectOption("0");await dialog.getByLabel("Map email").selectOption("1");await dialog.getByLabel("Map country").selectOption("2");
 expect((await json<{totalElements:number}>(api,"/api/data/customers?q="+encodeURIComponent(fresh))).totalElements).toBe(0);
 await dialog.getByRole("button",{name:"Validate against existing directory"}).click();
 await expect(dialog.getByRole("status")).toContainText("1 ready · 3 excluded · 0 saved");
 await testInfo.attach("csv-reviewed-preview.png",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 await expect(dialog.getByRole("button",{name:"Save reviewed records"})).toBeDisabled();
 await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"Save reviewed records"}).click();
 await expect(dialog.getByRole("status")).toContainText("1 saved");
 expect((await json<{totalElements:number}>(api,"/api/data/customers?q="+encodeURIComponent(fresh))).totalElements).toBe(1);
 await api.dispose();
});

test("truck catalog draft requires independent approval and links active products to RFQ comparison",async({page},testInfo)=>{
 const sourcing=await apiFor("SOURCING"),manager=await apiFor("MANAGEMENT");
 await useRole(page,"SOURCING");await page.goto("/workspace/products/new");
 const model=unique("truck model");
 await page.getByLabel("Manufacturer name").fill(unique("manufacturer"));
 await page.getByRole("button",{name:"Save manufacturer reference"}).click();
 await page.getByLabel("Model name *").fill(model);
 await page.getByLabel("Model code").fill(unique("model-code"));
 await page.getByLabel("Tank capacity (L)").fill("10000");
 await page.getByLabel("Overall dimensions (mm)").fill("Source entered test value");
 await page.getByLabel("Applications").fill("Synthetic test application");
 await page.getByRole("button",{name:"Save product draft"}).click();
 await expect(page.getByRole("heading",{name:model})).toBeVisible();
 await expect(page.getByText("DRAFT",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Approve product"})).toHaveCount(0);
 const detailAxe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
 expect(detailAxe.violations.filter(v=>["critical","serious"].includes(v.impact||""))).toEqual([]);
 await noPageOverflow(page);
 const draft=await json<{content:{id:string}[]}>(sourcing,"/api/products?q="+encodeURIComponent(model));
 const firstId=draft.content[0]?.id;
 expect(firstId).toBeTruthy();
 await json(manager,`/api/products/${firstId}/approve`,"POST",{});
 const category=(await json<{id:string}[]>(sourcing,"/api/products/categories"))[0];
 const second=await json<{id:string}>(sourcing,"/api/products","POST",{
  categoryId:category.id,modelName:unique("second active tanker"),modelCode:null,brand:null,description:null,
  specifications:[{fieldKey:"tank_capacity",label:"Tank capacity",value:"Test only",unit:"L"}],
  applications:[],configurations:[],marketNotes:[],documents:[],supplierIds:[]
 });
 await json(manager,`/api/products/${second.id}/approve`,"POST",{});
 const customer=await json<{id:string}>(sourcing,"/api/data/customers","POST",{name:unique("product RFQ buyer"),country:"BD"});
 const rfq=await json<{id:string}>(sourcing,"/api/trading/rfqs","POST",{customerId:customer.id,subject:unique("truck RFQ"),details:"Synthetic test",quantity:1,unit:"PCS",currency:"USD"});
 await page.goto(`/workspace/rfqs?rfqId=${rfq.id}`);
 await page.getByRole("button",{name:/Add item/}).click();
 await page.getByLabel("Catalog product (optional)").selectOption(firstId!);
 await expect(page.getByLabel("Product name *")).toHaveValue(new RegExp(model));
 await page.getByLabel("Quantity *").fill("1");await page.getByLabel("Unit *").fill("PCS");
 await page.getByRole("button",{name:/Save item/}).click();
 await expect(page.getByText(model,{exact:false}).first()).toBeVisible();
 const lines=await json<{truckProductId:string}[]>(sourcing,`/api/trading/rfqs/${rfq.id}/items`);
 expect(lines[0].truckProductId).toBe(firstId);
 await page.goto(`/workspace/products/compare?ids=${firstId},${second.id}`);
 await expect(page.getByRole("heading",{name:"Compare truck products"})).toBeVisible();
 await expect(page.locator(".prd-compare tbody")).toContainText("Tank capacity");
 const comparisonAxe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
 expect(comparisonAxe.violations.filter(v=>["critical","serious"].includes(v.impact||""))).toEqual([]);
 await noPageOverflow(page);
 await testInfo.attach("truck-product-compare.png",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 await page.goto("/workspace/products");await expect(page.getByRole("heading",{name:"Truck product catalog"})).toBeVisible();await noPageOverflow(page);
 const catalogAxe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
 expect(catalogAxe.violations.filter(v=>["critical","serious"].includes(v.impact||""))).toEqual([]);
 await sourcing.dispose();await manager.dispose();
});

test("six Nexus review routes support light and dark without overflow or serious accessibility failures",async({page},testInfo)=>{
 test.setTimeout(180_000);await useRole(page);
 // Illustrative records exist only in the disposable test database; all writes use real guarded APIs.
 const api=await apiFor(),staff=await json<{id:string;username:string}[]>(api,"/api/enterprise/staff/options");
 const me=staff.find(person=>person.username===accounts().ADMIN.username)!,peer=staff.find(person=>person.username===accounts().BD.username)!;
 const today=new Date().toISOString().slice(0,10),myTask=unique("illustrative quotation follow-up"),peerTask=unique("illustrative team handoff");
 await json(api,"/api/enterprise/tasks","POST",{title:myTask,assigneeId:me.id,priority:"HIGH",dueDate:today});
 await json(api,"/api/enterprise/tasks","POST",{title:peerTask,assigneeId:peer.id,priority:"HIGH",dueDate:today});
 const illustrativeLead=await json<{id:string}>(api,"/api/growth/leads","POST",{companyName:unique("illustrative truck buyer"),contactName:"Synthetic contact",source:"MANUAL",subject:"E2E illustrative water-truck inquiry",ownerId:me.id,nextFollowUp:today,description:"Illustrative fixture in disposable database only"});
 await api.dispose();
 const routes=[['my-day','/workspace','/api/workspace-overview'],['executive','/workspace/command-center','/api/workspace-overview'],['crm','/workspace?view=customers','/api/data/customers?'],['suppliers','/workspace?view=suppliers','/api/data/suppliers?'],['trading','/workspace/rfqs','/api/trading/rfqs?'],['logistics','/workspace/shipments/line','/api/enterprise/logistics/line-shipments?']];
 for(const [name,path,endpoint] of routes){
  const loaded=page.waitForResponse(r=>r.url().includes(endpoint)&&r.ok());await page.goto(path);await loaded;
  if(name==='my-day'){await expect(page.locator(".nx-priority")).toContainText(myTask);await expect(page.locator(".nx-priority")).not.toContainText(peerTask);}
  if(name==='executive')await expect(page.locator(".nx-priority")).toContainText(peerTask);
  await expect(page.locator("h1")).toBeVisible();await expect(page.getByRole("button",{name:"Jump to anything"})).toBeVisible();
  for(const theme of ['light','dark']){
   if(await page.getByRole("button",{name:'Switch to '+theme+' theme'}).isVisible())await page.getByRole("button",{name:'Switch to '+theme+' theme'}).click();
   await expect(page.locator(".nx-shell")).toHaveAttribute("data-nexus-theme",theme);await noPageOverflow(page);
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   await testInfo.attach(name+'-'+theme+'.png',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
   await testInfo.attach(name+'-'+theme+'-axe.json',{body:JSON.stringify(result.violations),contentType:'application/json'});
   expect(result.violations.filter(v=>['critical','serious'].includes(v.impact||'')),name+' '+theme).toEqual([]);
  }
  if(name==='my-day'){
   const expand=page.getByRole("button",{name:/Show all .* snapshot records/});if(await expand.isVisible())await expand.click();
   await page.locator('.nx-priority a[href*="'+illustrativeLead.id+'"]').click();
   await expect(page.getByRole("region",{name:"Lead qualification triage"})).toBeVisible();
   const detail=page.getByRole("dialog");await expect(detail).toBeFocused();await page.keyboard.press("Shift+Tab");
   expect(await detail.evaluate(root=>root.contains(document.activeElement))).toBe(true);
   const triageAxe=await new AxeBuilder({page}).include(".gx-dialog").withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   await testInfo.attach("lead-deep-link-axe.json",{body:JSON.stringify(triageAxe.violations),contentType:"application/json"});
   await testInfo.attach("lead-triage-deep-link.png",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
   expect(triageAxe.violations.filter(v=>['serious','critical'].includes(v.impact||''))).toEqual([]);
   await page.keyboard.press("Escape");
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
