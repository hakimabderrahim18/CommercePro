const readline = require('readline');
const { generateLicenseKey, getMachineId } = require('./licenseManager');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  console.log('\n======================================================');
  console.log('   GÉNÉRATEUR DE CLÉS DE LICENCE — COMMERCE PRO       ');
  console.log('            HA SOFTWARES ACADÉMIE                    ');
  console.log('======================================================\n');

  const clientName = await question('1. Nom du Client / Établissement (ex: Supérette El Bahia) : ');
  if (!clientName.trim()) {
    console.log('Nom client obligatoire. Opération annulée.');
    rl.close();
    return;
  }

  const machineId = await question(`2. Code Machine ID du client [Entrée pour cette machine: ${getMachineId()}] : `);
  const finalMachineId = machineId.trim() || getMachineId();

  const typeChoice = await question('3. Type de licence (1: À VIE [Défaut], 2: 30 Jours, 3: 1 An, 4: Personnalisé) : ');

  let type = 'LIFETIME';
  let durationDays = 365;

  if (typeChoice.trim() === '2') {
    type = 'TIME_LIMITED';
    durationDays = 30;
  } else if (typeChoice.trim() === '3') {
    type = 'TIME_LIMITED';
    durationDays = 365;
  } else if (typeChoice.trim() === '4') {
    type = 'TIME_LIMITED';
    const daysStr = await question('   Nombre de jours de validité : ');
    durationDays = parseInt(daysStr, 10) || 30;
  }

  const licenseKey = generateLicenseKey({
    clientName: clientName.trim(),
    machineId: finalMachineId.trim(),
    type,
    durationDays
  });

  console.log('\n------------------------------------------------------');
  console.log('🎉 CLÉ DE LICENCE GÉNÉRÉE AVEC SUCCÈS :');
  console.log('------------------------------------------------------\n');
  console.log(licenseKey);
  console.log('\n------------------------------------------------------');
  console.log(`- Client      : ${clientName.trim()}`);
  console.log(`- Machine ID  : ${finalMachineId.trim()}`);
  console.log(`- Type        : ${type === 'LIFETIME' ? 'À VIE (Illimitée)' : `${durationDays} Jours`}`);
  console.log('------------------------------------------------------\n');

  rl.close();
}

main().catch(console.error);
