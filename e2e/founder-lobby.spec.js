import { expect, test } from '@playwright/test';

test('founder themes persist, INR metrics refresh, and mobile controls fit', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  test.skip(!process.env.FOUNDER_LOBBY_PIN, 'Requires an isolated server with a test Founder PIN');
  const signup = await page.request.post('/api/auth/signup', {data: {
    email: `founder-e2e-${Date.now()}@example.test`, fullName:'Founder Test', password:'E2e-password-123!',
  }});
  expect(signup.status()).toBe(201);
  await page.goto('/founder');
  await page.getByLabel('Access PIN').fill(process.env.FOUNDER_LOBBY_PIN);
  await page.getByRole('button', {name:'Enter room'}).click();
  const picker = page.getByRole('combobox', {name:'Founder Lobby theme'});
  await expect(picker).toBeVisible();
  for (const theme of ['forest','ocean','midnight','burgundy']) {
    await picker.selectOption(theme);
    await expect(page.locator('main')).toHaveAttribute('data-founder-theme',theme);
  }
  await picker.selectOption('midnight');
  await page.reload();
  await expect(picker).toHaveValue('midnight');
  const nav = page.getByRole('navigation', {name:'Founder Lobby areas'});
  await nav.getByRole('button', {name:/Sales/}).click();
  await expect(page.getByRole('heading',{name:'Commercial overview'})).toBeVisible();
  await nav.getByRole('button', {name:/Leads/}).click();
  await page.getByRole('button',{name:'Add lead'}).click();
  await page.getByLabel('Client or contact').fill('Founder browser test');
  await page.getByRole('combobox',{name:'Stage',exact:true}).selectOption('won');
  await page.getByLabel('Value (INR)').fill('123456.50');
  await page.getByRole('button',{name:'Save lead'}).click();
  await expect(page.getByText('Founder browser test',{exact:true})).toBeVisible();
  await nav.getByRole('button', {name:/Sales/}).click();
  await expect(page.getByText('₹1,23,456.50',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Commercial overview'})).toBeInViewport();
  await page.screenshot({path:'test-results/founder-midnight-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect(picker).toBeVisible();
  const bounds = await picker.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await picker.selectOption('forest');
  await expect(page.locator('main')).toHaveAttribute('data-founder-theme','forest');
  await expect(page.locator('main')).toHaveCSS('background-color','rgb(242, 245, 239)');
  await page.screenshot({path:'test-results/founder-forest-mobile.png'});
});
