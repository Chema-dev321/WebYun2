const { sendNapNotification } = require('./napNotifier');

async function main() {
    console.log('=== NAP Notifier - Ejemplo de uso ===\n');

    console.log('1. Probando evento LLENA (NAP al 100% de capacidad)...');
    const resultadoLlena = await sendNapNotification(
        'NAP-001',
        'Av. Corrientes 1234, CABA',
        'LLENA'
    );
    console.log('Resultado:', resultadoLlena, '\n');

    console.log('2. Probando evento VACIA (NAP 100% disponible)...');
    const resultadoVacia = await sendNapNotification(
        'NAP-002',
        'Av. Santa Fe 5678, CABA',
        'VACIA'
    );
    console.log('Resultado:', resultadoVacia, '\n');

    console.log('=== Pruebas finalizadas ===');
}

main().catch(err => console.error('Error inesperado:', err));
