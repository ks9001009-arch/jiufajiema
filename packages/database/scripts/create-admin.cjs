const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const password = '123456'
  const passwordHash = await bcrypt.hash(password, 10)

  // 创建公司
  const company = await prisma.company.upsert({
    where: {
      code: 'JIUFA',
    },
    update: {},
    create: {
      name: '玖发接码平台',
      code: 'JIUFA',
      status: 'ACTIVE',
    },
  })

  // 创建超级管理员角色
  const role = await prisma.role.upsert({
    where: {
      code: 'SUPER_ADMIN',
    },
    update: {
      permissions: [
        'company.read',
        'company.write',
        'team.read',
        'team.write',
        'role.read',
        'role.write',
        'user.read',
        'user.write',
        'audit.read',
      ],
    },
    create: {
      name: '超级管理员',
      code: 'SUPER_ADMIN',
      description: '系统最高权限管理员',
      permissions: [
        'company.read',
        'company.write',
        'team.read',
        'team.write',
        'role.read',
        'role.write',
        'user.read',
        'user.write',
        'audit.read',
      ],
    },
  })

  // 创建管理员用户
  const user = await prisma.user.upsert({
    where: {
      username: 'admin_login',
    },
    update: {
      passwordHash,
      displayName: '系统管理员',
      status: 'ACTIVE',
      companyId: company.id,
      roleId: role.id,
    },
    create: {
      username: 'admin_login',
      passwordHash,
      displayName: '系统管理员',
      status: 'ACTIVE',
      companyId: company.id,
      roleId: role.id,
    },
  })

  console.log('初始化完成:')
  console.log({
    company: company.name,
    role: role.name,
    username: user.username,
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