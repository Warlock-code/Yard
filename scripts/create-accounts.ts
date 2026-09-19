import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function getCampusFromEmail(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  
  const campusMap: Record<string, string> = {
    'live.gctu.edu.gh': 'GCTU',
    'gctu.edu.gh': 'GCTU',
    'student.gctu.edu.gh': 'GCTU',
    'ug.edu.gh': 'UG',
    'st.ug.edu.gh': 'UG',
    'knust.edu.gh': 'KNUST',
    'sms.knust.edu.gh': 'KNUST',
    'uis.edu.gh': 'UIS',
    'ucc.edu.gh': 'UCC',
    'st.ucc.edu.gh': 'UCC',
    'uew.edu.gh': 'UEW',
    'st.uew.edu.gh': 'UEW',
    'umds.edu.gh': 'UMDS',
    'stu.edu.gh': 'STU',
    'tuc.edu.gh': 'TUC',
    'atu.edu.gh': 'ATU',
    'ktu.edu.gh': 'KTU',
    'cktu.edu.gh': 'CKTU',
    'aamu.edu.gh': 'AAMU',
    'pau.edu.gh': 'PAU',
    'dmu.edu.gh': 'DMU',
    'uhas.edu.gh': 'UHAS',
    'unimac.edu.gh': 'UNIMAC',
    'acdi.edu.gh': 'ACDI',
    'csir.edu.gh': 'CSIR',
    'gims.edu.gh': 'GIMS',
    'rims.edu.gh': 'RIMS',
    'ips.edu.gh': 'IPS',
    'gset.edu.gh': 'GSET',
    'nmimt.edu.gh': 'NMIMT',
    'gtuc.edu.gh': 'GTUC',
    'wiuc.edu.gh': 'WIUC',
    'ruc.edu.gh': 'RUC',
    'puc.edu.gh': 'PUC',
    'cucg.edu.gh': 'CUCG',
    'knustford.edu.gh': 'KNUSTFORD',
    'bluecrest.edu.gh': 'BLUECREST',
    'ipmc.edu.gh': 'IPMC',
    'nita.edu.gh': 'NITA',
    'gettysburg.edu.gh': 'GETTYSBURG',
    'ashtesi.edu.gh': 'ASHTESI',
    'gti.edu.gh': 'GTI',
    'jppgc.edu.gh': 'JPPGC',
    'mmic.edu.gh': 'MMIC',
    'ncte.edu.gh': 'NCTE',
    'ntc.edu.gh': 'NTC',
    'sda.edu.gh': 'SDA',
    'tipep.edu.gh': 'TIPEP',
    'tset.edu.gh': 'TSET',
    'wcsc.edu.gh': 'WCSC',
  };
  
  return campusMap[domain] || null;
}

function getProgramKey(campus: string, program: string | null): string | null {
  if (!program) return null;
  return `${campus.toLowerCase()}_${program.toLowerCase().replace(/\s+/g, '_')}`;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function createUser(email: string, password: string, campus: string, ghostId: string, tier: 'PLUS' | 'PRIME' = 'PLUS') {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, updating...`);
    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        ghostId,
        tier,
        emailVerified: true,
        status: 'ACTIVE',
        ghostCoins: 1000,
      },
    });
    console.log(`Updated ${email} with tier ${tier}`);
    return existing;
  }

  const passwordHash = await hashPassword(password);
  const inviteCode = `inv_${crypto.randomBytes(4).toString('hex')}`;
  const programKey = getProgramKey(campus, null);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      campus,
      ghostId,
      avatarEmoji: '👻',
      tier,
      emailVerified: true,
      status: 'ACTIVE',
      ghostCoins: 1000,
      freeBoosts: 5,
      storageUsed: 0,
      storageLimit: tier === 'PRIME' ? 200 : 100,
      inviteCode,
      referralCount: 0,
      streakCount: 0,
    },
  });
  console.log(`Created ${email} (${ghostId}) with tier ${tier}`);
  return user;
}

async function main() {
  console.log('Creating accounts...\n');

  await createUser(
    '2526404295@live.gctu.edu.gh',
    'Airman2008.',
    'GCTU',
    'Airman2008',
    'PLUS'
  );

  await createUser(
    'aj_phyner@live.gctu.edu.gh',
    'Airman2008.',
    'GCTU',
    'AjPhyner',
    'PLUS'
  );

  console.log('\nDone! You can now log in with:');
  console.log('  2526404295@live.gctu.edu.gh / Airman2008.');
  console.log('  aj_phyner@live.gctu.edu.gh / Airman2008.');
  console.log('\nBoth accounts have PLUS tier.');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});