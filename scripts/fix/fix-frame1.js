const http = require('http');

async function cmd(action, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, params });
    const req = http.request({
      hostname: 'localhost', port: 9001, path: '/command', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.result);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const FRAME_ID = '32:1293';

async function main() {
  // --- ADIM 1: Mevcut durumu kontrol et ---
  console.log('ADIM 1: Frame icerigi inceleniyor...');
  const deep = await cmd('get_children', { nodeId: FRAME_ID, depth: 1 });
  deep.children.forEach((c, i) =>
    console.log(i + '.', c.name, '| pos:', c.x + ',' + c.y, '| size:', c.width + 'x' + c.height, '| id:', c.nodeId)
  );

  // --- ADIM 2: Duplikat Navigation'i sil (ilk olan) ---
  console.log('\nADIM 2: Duplikat Alarm Top Navigation siliniyor (32:31860)...');
  try {
    const del = await cmd('delete_node', { nodeId: '32:31860' });
    console.log('Silindi:', del.name);
  } catch (e) {
    console.error('Silme HATA:', e.message);
  }

  await new Promise(r => setTimeout(r, 400));

  // --- ADIM 3: Kalan child'ları tekrar kontrol et ---
  console.log('\nADIM 3: Silme sonrası durum:');
  const after = await cmd('get_children', { nodeId: FRAME_ID, depth: 1 });
  after.children.forEach((c, i) =>
    console.log(i + '.', c.name, '| pos:', c.x + ',' + c.y, '| size:', c.width + 'x' + c.height, '| id:', c.nodeId)
  );

  // Navigation ve Page nodeId'lerini bul
  const navNode = after.children.find(c => c.name.includes('Alarm Top Navigation') || c.name.includes('Navigation'));
  const pageNode = after.children.find(c => c.name.includes('Alarm Page') || c.name.includes('Page'));

  console.log('\nNavigation:', navNode ? navNode.nodeId + ' (' + navNode.height + 'px yüksek)' : 'BULUNAMADI');
  console.log('Page:', pageNode ? pageNode.nodeId : 'BULUNAMADI');

  // --- ADIM 4: Navigation'i 390px genişliğe resize et ve y:0'a konumla ---
  if (navNode) {
    console.log('\nADIM 4a: Navigation 390px genisliğe ayarlaniyor, y:0...');
    await cmd('update_node', { nodeId: navNode.nodeId, x: 0, y: 0, width: 390 });
    console.log('OK');
    await new Promise(r => setTimeout(r, 400));
  }

  // Navigation yüksekliğini güncelle
  const navUpdated = await cmd('get_node_details', { nodeId: navNode.nodeId });
  const navHeight = navUpdated.height || 286;
  console.log('Navigation yüksekliği:', navHeight + 'px');

  // --- ADIM 5: Alarm Page'i navigation'ın altına taşı, 390px genişlik ---
  if (pageNode) {
    const newY = navHeight; // Navigation'ın hemen altı
    console.log('\nADIM 4b: Alarm Page y:' + newY + ' konumuna aliniyor, 390px genislik...');
    await cmd('update_node', { nodeId: pageNode.nodeId, x: 0, y: newY, width: 390 });
    console.log('OK');
    await new Promise(r => setTimeout(r, 400));
  }

  // --- ADIM 5: Frame'i resize et (içeriğe sığacak şekilde) ---
  const totalHeight = navHeight + (pageNode ? (844 - navHeight) : 0);
  console.log('\nADIM 5: Frame boyutu 390x844 olarak sabitleniyor...');
  await cmd('update_node', { nodeId: FRAME_ID, width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 400));

  // --- ADIM 6: Level/surface token'ı bulmaya çalış ---
  console.log('\nADIM 6: Library variables inceleniyor (level/surface)...');
  try {
    const libVars = await cmd('list_library_variables', {
      nameFilter: 'surface',
      resolvedType: 'COLOR'
    });
    if (libVars.collections && libVars.collections.length > 0) {
      console.log('Bulunan collections:');
      libVars.collections.forEach(col => {
        console.log('  Library:', col.libraryName, '| Collection:', col.name);
        col.variables.forEach(v => console.log('    -', v.name, '| key:', v.key));
      });

      // level/surface key'ini bul
      let surfaceKey = null;
      for (const col of libVars.collections) {
        const surfaceVar = col.variables.find(v =>
          v.name === 'level/surface' || v.name.includes('level/surface')
        );
        if (surfaceVar) {
          surfaceKey = surfaceVar.key;
          console.log('\nlevel/surface key:', surfaceKey);
          break;
        }
      }

      if (surfaceKey) {
        // Frame background'ına bağla
        console.log('\nADIM 7: level/surface frame\'e baglanıyor...');
        const bind = await cmd('bind_variable', {
          nodeId: FRAME_ID,
          variableKey: surfaceKey,
          field: 'fills'
        });
        console.log('Variable baglandi:', bind.boundVariable);
      } else {
        console.log('level/surface key bulunamadi, renk token listesi:');
        libVars.collections.forEach(col =>
          col.variables.slice(0, 5).forEach(v => console.log('  -', v.name, v.key))
        );
      }
    } else {
      console.log('Library variable bulunamadi — manuel renk kullanilacak');
      // Kripto Dark mode level/surface değeri: ~#1B1B21
      await cmd('update_node', {
        nodeId: FRAME_ID,
        fillColor: '#1B1B21'
      });
      console.log('Renk #1B1B21 (Kripto Dark level/surface) uygulandı');
    }
  } catch (e) {
    console.error('Variable HATA:', e.message);
  }

  // --- ADIM 7: Final durumu kontrol ---
  console.log('\n=== FINAL DURUM ===');
  const final = await cmd('get_children', { nodeId: FRAME_ID, depth: 1 });
  final.children.forEach((c, i) =>
    console.log(i + '.', c.name, '| pos:', c.x + ',' + c.y, '| size:', c.width + 'x' + c.height)
  );
  const frameDetails = await cmd('get_node_details', { nodeId: FRAME_ID });
  console.log('Frame size:', frameDetails.width + 'x' + frameDetails.height);
  console.log('Frame fill:', JSON.stringify(frameDetails.fills));
}

main().catch(e => console.error('KRITIK HATA:', e.message));
