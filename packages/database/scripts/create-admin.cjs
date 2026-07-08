const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const username = 'admin_login'
  const password = '123456'
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: {
      username,
    },
    update: {
      passwordHash,
      displayName: '系统管理员',
      status: 'ACTIVE',
    },
    create: {
      username,
      passwordHash,
      displayName: '系统管理员',
      status: 'ACTIVE',
    },
  })

  console.log('管理员账号已初始化：')
  console.log({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
  })

  console.log('')
  console.log('登录账号：admin_login')
  console.log('登录密码：123456')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
