/**
 * Script para encontrar e listar vendas duplicadas de mesa com valor R$ 43,90
 * do dia 20/05/2026.
 * 
 * Uso: node find_duplicates.cjs
 * Para deletar: node find_duplicates.cjs --delete <ID>
 */
process.env.GOOGLE_APPLICATION_CREDENTIALS = '../keys/serviceAccountKey.json';
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const action = process.argv[2];
    const deleteId = process.argv[3];

    if (action === '--delete' && deleteId) {
        console.log(`\n🗑️  Deletando venda ${deleteId}...`);
        await db.collection('vendas').doc(deleteId).delete();
        console.log('✅ Venda deletada com sucesso!\n');
        process.exit(0);
        return;
    }

    console.log('\n🔍 Buscando vendas de mesa...\n');

    // Busca todas vendas de mesa
    const snap = await db.collection('vendas')
        .where('origem', '==', 'mesa')
        .get();

    const vendas43 = [];
    snap.forEach(d => {
        const data = d.data();
        const total = data.total || 0;
        // Filtra por valor ~43.90
        if (Math.abs(total - 43.9) < 0.1) {
            const createdAt = data.createdAt?._seconds 
                ? new Date(data.createdAt._seconds * 1000) 
                : null;
            vendas43.push({
                id: d.id,
                shortId: d.id.slice(0, 6),
                mesaNumero: data.mesaNumero,
                total: data.total,
                createdAt: createdAt ? createdAt.toISOString() : 'N/A',
                formaPagamento: Object.values(data.pagamentos || {}).map(p => p.formaPagamento).join(', ') || 'N/A',
                funcionario: data.funcionario || 'N/A'
            });
        }
    });

    if (vendas43.length === 0) {
        console.log('Nenhuma venda de mesa com valor R$ 43,90 encontrada.');
    } else {
        console.log(`Encontradas ${vendas43.length} vendas de R$ 43,90:\n`);
        vendas43.forEach((v, i) => {
            console.log(`--- Venda ${i + 1} ---`);
            console.log(`  ID completo: ${v.id}`);
            console.log(`  ID curto:    #${v.shortId}`);
            console.log(`  Mesa:        ${v.mesaNumero}`);
            console.log(`  Total:       R$ ${v.total?.toFixed(2)}`);
            console.log(`  Criado em:   ${v.createdAt}`);
            console.log(`  Pagamento:   ${v.formaPagamento}`);
            console.log(`  Funcionário: ${v.funcionario}`);
            console.log('');
        });
        console.log('Para deletar uma duplicada, rode:');
        console.log('  node find_duplicates.cjs --delete <ID_COMPLETO>\n');
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
