import { expect, test } from '@playwright/test';
import { createInvitedAccount } from './helpers/accounts.js';

test('founder lobby follows the app theme, INR metrics refresh, and mobile controls fit', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce', colorScheme:'dark'});
  test.skip(!process.env.FOUNDER_LOBBY_PIN, 'Requires an isolated server with a test Founder PIN');
  await createInvitedAccount(page, {prefix:'founder-e2e', fullName:'Founder Test'});
  await page.goto('/founder');
  await page.getByLabel('Access PIN').fill(process.env.FOUNDER_LOBBY_PIN);
  await page.getByRole('button', {name:'Enter room'}).click();
  await expect(page.locator('main[data-founder-room]')).toBeVisible();
  // The room borrows the app tokens: dark mode uses the dark canvas.
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('main[data-founder-room]')).toHaveCSS('background-color','rgb(14, 14, 13)');
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
  await page.screenshot({path:'test-results/founder-dark-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  const lock = page.getByRole('button', {name:'Lock Founder Lobby'});
  await expect(lock).toBeVisible();
  const bounds = await lock.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:'test-results/founder-dark-mobile.png'});
});
