import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main(){
  const user = await prisma.user.findUnique({where:{email:'aj_phyner@live.gctu.edu.gh'}});
  console.log('VERIFY QUERY AFTER CREATION:');
  console.log(JSON.stringify(user,null,2));
  console.log('bcrypt compare Iamthebest. =>', await bcrypt.compare('Iamthebest.', user!.passwordHash));
  console.log('campus correct?', user!.campus==='GCTU');
  console.log('emailVerified?', user!.emailVerified);
  console.log('verifyCode null?', user!.verifyCode===null);
  console.log('tier?', user!.tier);
  console.log('ghostId', user!.ghostId);
  console.log('inviteCode', user!.inviteCode);
  await prisma.$disconnect();
}
main();
