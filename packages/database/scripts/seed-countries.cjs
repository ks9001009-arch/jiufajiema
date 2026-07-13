const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const SEED_COUNTRIES = [
  { code: 'US', nameZh: '美国', nameEn: 'United States', emoji: '🇺🇸', sortOrder: 10 },
  { code: 'CA', nameZh: '加拿大', nameEn: 'Canada', emoji: '🇨🇦', sortOrder: 20 },
  { code: 'CN', nameZh: '中国', nameEn: 'China', emoji: '🇨🇳', sortOrder: 30 },
  { code: 'HK', nameZh: '中国香港', nameEn: 'Hong Kong', emoji: '🇭🇰', sortOrder: 40 },
  { code: 'MO', nameZh: '中国澳门', nameEn: 'Macao', emoji: '🇲🇴', sortOrder: 50 },
  { code: 'TW', nameZh: '中国台湾', nameEn: 'Taiwan', emoji: '🇹🇼', sortOrder: 60 },
  { code: 'SG', nameZh: '新加坡', nameEn: 'Singapore', emoji: '🇸🇬', sortOrder: 70 },
  { code: 'MY', nameZh: '马来西亚', nameEn: 'Malaysia', emoji: '🇲🇾', sortOrder: 80 },
  { code: 'TH', nameZh: '泰国', nameEn: 'Thailand', emoji: '🇹🇭', sortOrder: 90 },
  { code: 'GB', nameZh: '英国', nameEn: 'United Kingdom', emoji: '🇬🇧', sortOrder: 100 },
  { code: 'JP', nameZh: '日本', nameEn: 'Japan', emoji: '🇯🇵', sortOrder: 110 },
  { code: 'KR', nameZh: '韩国', nameEn: 'South Korea', emoji: '🇰🇷', sortOrder: 120 },
]

async function main() {
  for (const country of SEED_COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: {
        nameZh: country.nameZh,
        nameEn: country.nameEn,
        emoji: country.emoji,
        enabled: true,
        sortOrder: country.sortOrder,
      },
      create: {
        ...country,
        enabled: true,
      },
    })
  }

  const enabledCountries = await prisma.country.findMany({
    where: { enabled: true },
    select: { code: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })

  const companies = await prisma.company.findMany({ select: { id: true, name: true } })

  for (const company of companies) {
    const existingCount = await prisma.companyCountry.count({
      where: { companyId: company.id },
    })

    if (existingCount > 0) {
      continue
    }

    await prisma.companyCountry.createMany({
      data: enabledCountries.map((country) => ({
        companyId: company.id,
        countryCode: country.code,
      })),
      skipDuplicates: true,
    })
  }

  console.log('国家字典 seed 完成:')
  console.log(`- 国家数量: ${enabledCountries.length}`)
  console.log(`- 已检查公司数量: ${companies.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
