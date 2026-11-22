import asyncio, json, mimetypes, urllib.parse
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=await browser.new_context(accept_downloads=True,viewport={'width':1440,'height':940})
    page=await context.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    async def route_handler(route):
      url=urllib.parse.urlsplit(route.request.url)
      name=urllib.parse.unquote(url.path.lstrip('/')) or 'index.html'
      file=Path(__file__).resolve().parents[1] / 'docs' / name
      if not file.is_file() or not file.resolve().is_relative_to((Path(__file__).resolve().parents[1] / 'docs')):
        await route.fulfill(status=404,body='Not found');return
      mime=mimetypes.guess_type(file)[0] or ('application/wasm' if file.suffix=='.wasm' else 'application/octet-stream')
      await route.fulfill(status=200,body=file.read_bytes(),content_type=mime)
    await page.route('**/*',route_handler)
    await page.goto('https://folio.test/',wait_until='networkidle')
    await page.wait_for_timeout(650)
    print('TITLE',await page.title())
    print('ERRORS',errors)
    print('STATUS',await page.locator('#saveState').inner_text())
    print('DOCS',await page.locator('#docCount').inner_text())
    await page.screenshot(path=str(Path(__file__).resolve().parent / 'home.png'))
    await page.locator('#newDoc').click()
    await page.locator('#title').fill('Examen de prueba · Septiembre')
    await page.locator('#editor').fill('Una pregunta importante con palabras y símbolos √ ≤')
    await page.locator('#saveDoc').click()
    await page.wait_for_timeout(500)
    print('SAVED',await page.locator('#saveState').inner_text())
    await page.reload(wait_until='networkidle')
    await page.wait_for_timeout(650)
    print('RELOADED',await page.locator('#title').input_value(),await page.locator('#editor').inner_text())
    await page.locator('#docSearch').fill('septiembre')
    await page.wait_for_timeout(200)
    print('SEARCH',await page.locator('#docCount').inner_text())
    await page.locator('button[data-view="bank"]').click()
    await page.locator('#newQuestion').click()
    await page.locator('#qText').fill('¿Qué es el coste de oportunidad?')
    await page.locator('#qTopic').fill('Microeconomía')
    await page.locator('#qDifficulty').select_option('Fácil')
    opts=page.locator('#qOptions input[type="text"]')
    for i,v in enumerate(['Una deuda','La mejor alternativa sacrificada','El coste fijo','Ninguna']): await opts.nth(i).fill(v)
    await page.locator('#qOptions input[type=radio]').nth(1).check()
    await page.locator('#questionForm button[type=submit]').click()
    print('BANK',await page.locator('#statQuestions').inner_text())
    await page.locator('button[data-view="exam"]').click()
    await page.locator('#examN').fill('1')
    await page.locator('#generateExam').click()
    print('EXAM',await page.locator('#title').input_value(), 'open tabs:',await page.locator('.document-tab').count())
    await page.reload(wait_until='networkidle');await page.wait_for_timeout(300)
    print('RELOADED BANK',await page.locator('#bankCount').inner_text())
    # synthetic PDF in original source example
    await page.locator('button[data-view="bank"]').click()
    await page.locator('#fileBank').set_input_files(str(Path(__file__).resolve().parent / 'go/examples/banco-marcas.pdf'))
    await page.wait_for_timeout(2000)
    print('PDF DIALOG',await page.locator('#importDialog').get_attribute('open'))
    print('PDF SUMMARY',await page.locator('#importSummary').inner_text())
    print('ERRORS END',errors)
    await browser.close()
asyncio.run(main())
