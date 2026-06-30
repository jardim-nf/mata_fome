import { BrasilNFe } from 'brasilnfe';

async function test() {
    const token = "TEtGbXJZAHBudnhLOHIQbIAxTWxKa3hXOXllb1IrU3creVIOVGlpDC90MD06SIVF";
    const client = new BrasilNFe(token);
    try {
        const result = await client.consultas.obterNotasFiscais({ 
            TipoDocumentoFiscal: 1, 
            DtInicio: "2026-06-28", 
            DtFim: "2026-06-29" 
        });
        console.log("Result:", JSON.stringify(result).substring(0, 500));
    } catch(e) {
        console.error("Error:", e.message);
    }
}
test();
