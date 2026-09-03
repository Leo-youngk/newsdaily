export interface Top50Article {
  idSuffix: string;
  sourceId: string;
  sourceName: string;
  category: '访谈' | '思想' | '商业' | '人文';
  lang: 'en' | 'zh';
  title: string;
  titleZh: string;
  author: string;
  url: string;
  audioUrl?: string;
  readingMinutes: number;
  tags: string[];
  summary: string;
  coreInsight: string;
  htmlSections: Array<{
    heading: string;
    paragraphs: Array<{
      en: string;
      zh: string;
    }>;
  }>;
}

export const TOP50_ARTICLES: Top50Article[] = [
  // ==========================================
  // 一、 商业史诗与战略护城河 (1-10)
  // ==========================================
  {
    idSuffix: 'acquired-nvidia',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'NVIDIA: The Complete History and Strategy',
    titleZh: '英伟达史诗：图形芯片小厂到万亿算力帝国的生死下注',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/nvidia-the-gpu-company',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ9367683935.mp3',
    readingMinutes: 35,
    tags: ['商业史', '战略护城河', '半导体', '计算架构'],
    summary: '商业历史上最壮丽的非共识战略下注。深度复盘黄仁勋如何在濒临破产、没有下游生态、甚至遭遇华尔街普遍嘲讽的情况下，自费数十亿美元坚持研发并普及 CUDA 架构，最终将先发优势转化为全球最坚固的算力垄断壁垒。',
    coreInsight: '护城河不仅是硬件算力，而是硬件与软硬件开发生态（CUDA）长达二十年形成的超强网络效应。',
    htmlSections: [
      {
        heading: '第一章：Denny’s 餐厅与濒临破产的生死豪赌 (1993-1997)',
        paragraphs: [
          {
            en: 'In 1993, Jensen Huang, Chris Malachowsky, and Curtis Priem met at a Denny’s diner in San Jose. Their thesis was radical: PCs would become the ultimate consumer device for 3D graphics.',
            zh: '1993 年，黄仁勋与两位合伙人在加州圣何塞的一家 Denny’s 通宵餐厅碰头。他们的核心假设在当时极其激进：个人电脑（PC）终将成为 3D 图形计算的终极消费载体。'
          },
          {
            en: 'Their first product, the NV1, was a catastrophic commercial failure because it bet on quadratic curved surfaces just as Microsoft standardized on polygonal DirectX. NVIDIA was 30 days away from going out of business.',
            zh: '他们的第一款产品 NV1 遭遇了灾难性的商业失败——因为他们押注了二次曲面技术，而微软正好将多边形渲染确立为 DirectX 行业标准。英伟达账面资金一度只够支撑最后 30 天。'
          },
          {
            en: 'Jensen made the brutal call to pivot completely to polygonal rendering with the RIVA 128, shipping it on a razor-thin margin of survival. It saved the company and established the culture of operational urgency.',
            zh: '黄仁勋做出了极其决绝的战略转向：全面拥抱多边形架构并推出 RIVA 128，在生死存亡的钢丝绳上完成逆风翻盘。这也奠定了英伟达日后“始终距离倒闭只有 30 天”的危机文化。'
          }
        ]
      },
      {
        heading: '第二章：CUDA 的豪赌与华尔街的嘲笑 (2006-2012)',
        paragraphs: [
          {
            en: 'In 2006, NVIDIA announced CUDA. Jensen decided that every single GPU shipped would include dedicated transistors for general-purpose computing, regardless of cost.',
            zh: '2006 年，英伟达发布了 CUDA 平台。黄仁勋做出了一个在当时被华尔街视作疯子的决定：每一颗售出的显卡都必须硬塞入支持通用并行计算的额外晶体管，无论成本多么高昂。'
          },
          {
            en: 'For nearly a decade, Wall Street punished NVIDIA stock because CUDA crushed profit margins while virtually no mainstream consumer software utilized it. Jensen absorbed the blow and subsidized universities and researchers.',
            zh: '在长达近十年的时间里，资本市场不断惩罚英伟达的股价，因为 CUDA 严重侵蚀了毛利率，却几乎没有任何主流消费级软件能用到它。黄仁勋顶住压力，持续自费向全球高校与学者赠送计算硬件并培育开发者。'
          },
          {
            en: 'When AlexNet revolutionized deep learning in 2012 on two consumer GeForce GTX 580 cards, CUDA was the only robust infrastructure ready to scale worldwide.',
            zh: '直到 2012 年，AlexNet 借助两块普通的 GeForce GTX 580 显卡引爆了深度学习革命，全球科学家骤然发现：CUDA 是世界上唯一一个开箱即用、能支撑大规模并行计算的工业级软件基石。'
          }
        ]
      },
      {
        heading: '第三章：战略护城河的终局推演 (Playbook & Moat)',
        paragraphs: [
          {
            en: 'NVIDIA’s true moat is not silicon speed; it is the software ecosystem. Millions of developers have muscle memory with CUDA libraries that no rival hardware can replicate overnight.',
            zh: '英伟达真正的护城河不是芯片的运行速度，而是软件生态。全球数百万开发者早已沉淀在 CUDA 的算法库与开发习惯中，这是任何竞争对手单凭硬件堆料都无法一夜复制的软性壁垒。'
          },
          {
            en: 'The lesson: A true moat is built during the dark years when everyone else thinks your investment is an unnecessary waste of capital.',
            zh: '商业启示：最坚不可摧的商业护城河，往往是在所有同行都认为你是在浪费资本的“至暗之年”里，咬牙死磕出来的。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'acquired-tsmc',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'TSMC: The Pure-Play Foundry Revolution',
    titleZh: '台积电传：张忠谋的纯代工模式与全球地缘科技护城河',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/tsmc',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ7162983711.mp3',
    readingMinutes: 30,
    tags: ['商业史', '半导体', '供应链', '商业模式'],
    summary: '张忠谋在 56 岁时创立台积电，开创了半导体历史上史无前例的“纯代工模式（Pure-play Foundry）”。通过绝不生产自有芯片、绝不与客户竞争的绝对中立承诺，赢得了从苹果到英伟达的无条件信任。',
    coreInsight: '商业定位的最高境界是“消除客户的战略戒心”，成为整个产业生态无法绕过的水电煤底座。',
    htmlSections: [
      {
        heading: '第一章：56岁的创举与代工范式的发明',
        paragraphs: [
          {
            en: 'Morris Chang realized in 1987 that semiconductor startups faced an insurmountable barrier: building a fab cost hundreds of millions of dollars. The separation of design and manufacturing was inevitable.',
            zh: '1987 年，56 岁的张忠谋敏锐地意识到芯片初创公司面临着不可逾越的壁垒：自建一座晶圆厂需要耗资数亿美元。芯片设计（Fabless）与物理制造（Foundry）的分离是历史必然。'
          },
          {
            en: 'He established the founding dogma of TSMC: We will never design chips. We will never compete with our customers. Your intellectual property is completely safe with us.',
            zh: '他确立了台积电立身立命的核心教条：我们永远不设计芯片，永远不与客户竞争。你们的核心知识产权在我们这里享有绝对的安全保障。'
          }
        ]
      },
      {
        heading: '第二章：规模与资本开支的滚雪球效应',
        paragraphs: [
          {
            en: 'As Apple, Qualcomm, and NVIDIA grew, all their production aggregated onto TSMC’s production lines. More volume meant faster yield learning curves, which meant lower costs and better margins.',
            zh: '随着苹果、高通、英伟达等芯片设计巨头的崛起，全行业的尖端产能全部汇聚在台积电的流水线上。产量的巨大规模带来了最快的良率爬坡速度，进而形成更低成本与超额利润的良性循环。'
          },
          {
            en: 'By reinvesting tens of billions of dollars annually into EUV lithography and advanced packaging, TSMC pulled away from Intel and Samsung, turning manufacturing into a geopolitical chokepoint.',
            zh: '通过每年数以百亿美元计的逆周期资本开支投入极紫外光刻（EUV）与先进封装，台积电彻底甩开了英特尔与三星，将纯代工制造演变成了全球地缘政治中最关键的咽喉要道。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'acquired-hermes',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'Hermès: The Physics of Ultra-Luxury',
    titleZh: '爱马仕：反工业流水线的奢侈品物理学与家族控制权防卫战',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/hermes',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ8271629817.mp3',
    readingMinutes: 28,
    tags: ['商业分析', '奢侈品', '品牌溢价', '护城河'],
    summary: '奢侈品行业最完美的商业解剖。揭示爱马仕如何通过坚持工匠手工缝制、拒绝规模化流水线、克制产量配额，将“人为制造的稀缺性”转化为抵御百年经济周期的终极资本壁垒。',
    coreInsight: '当所有人都在追求“效率”与“规模化”时，“不可扩张的手工稀缺性”反而成为了全商业界溢价最高的事物。',
    htmlSections: [
      {
        heading: '第一章：反直觉的手工工匠制度',
        paragraphs: [
          {
            en: 'At Hermès, a single artisan works on a Birkin or Kelly bag from start to finish for 15 to 20 hours. There is no division of labor assembly line.',
            zh: '在爱马仕工坊里，一只铂金包或凯莉包由单一工匠从头到尾手工缝制 15 到 20 个小时。这里没有任何工业化的流水线分工。'
          },
          {
            en: 'When demand doubles, Hermès does not speed up production. They train more artisans over two years. The refusal to scale instantly creates the perception of transcendent craftsmanship.',
            zh: '当市场需求暴增一倍时，爱马仕绝不加快生产节奏，而是按部就班花费两年时间培养新工匠。这种拒绝盲目扩张的定力，反而塑造了超越世俗工业品的无上品牌神话。'
          }
        ]
      },
      {
        heading: '第二章：LVMH 门口野蛮人的恶意收购战',
        paragraphs: [
          {
            en: 'Bernard Arnault secretly accumulated over 20% of Hermès stock using complex equity swaps. It was the ultimate corporate siege in luxury history.',
            zh: 'LVMH 总裁伯纳德·阿尔诺曾通过复杂的股票掉期交易秘密吸筹超过 20% 的爱马仕股份，发起了奢侈品商业史上最凶险的恶意吞并战。'
          },
          {
            en: 'Over 50 family descendants united to lock up 50.2% of the company into a private holding company for decades, forfeiting personal liquidity to preserve independent creative control.',
            zh: '面对资本巨鳄的猎杀，爱马仕家族五十多位后人展现出惊人的团结：他们共同将 50.2% 的股份锁入一家长期信托控股公司，自愿放弃个人套现套现流动性，只为捍卫品牌的独立与灵魂。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'acquired-microsoft-nadella',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'Microsoft: The Satya Nadella Era and Cloud Rebirth',
    titleZh: '微软帝国重生：纳德拉时代的文化重构与云端大象转身',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/microsoft-volume-2',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ9871625341.mp3',
    readingMinutes: 30,
    tags: ['商业史', '组织文化', '云计算', '战略转型'],
    summary: '微软如何在错失移动互联网之后，在萨提亚·纳德拉的领导下摆脱对 Windows 现金牛的病态执念，通过拥抱开源、押注 Azure 云计算和重塑同理心企业文化，完成万亿科技巨头的大象转身。',
    coreInsight: '企业转型最难的不是技术升级，而是放弃赖以成名的旧现金牛和内部政治山头。',
    htmlSections: [
      {
        heading: '第一章：放弃“Windows 优先”的政治死结',
        paragraphs: [
          {
            en: 'For decades, any project inside Microsoft had to serve the supremacy of Windows. When Nadella took over in 2014, he declared a "Mobile First, Cloud First" world where Office must run beautifully on Apple and Android.',
            zh: '几十年来，微软内部任何新业务都必须服从于 Windows 帝国的至高利益。纳德拉在 2014 年上任后，坚决打破了这一政治死结，推行“移动为先、云为先”，让 Office 完美适配竞品苹果 iOS 与安卓平台。'
          },
          {
            en: 'Embracing Linux on Azure was seen as heresy by old-guard executives, but it was the single decision that made Azure a genuine alternative to AWS for enterprise developers.',
            zh: '在 Azure 云上全面拥抱 Linux 曾被老派高管视作异端邪说，但正是这一包容性举措，让 Azure 真正成为了企业级开发者眼中能与亚马逊 AWS 分庭抗礼的云端底座。'
          }
        ]
      },
      {
        heading: '第二章：从“无所不知”到“无所不学”的文化重构',
        paragraphs: [
          {
            en: 'Nadella replaced the cutthroat internal grading system and bureaucratic arrogance with Carol Dweck’s "Growth Mindset." Leaders were expected to listen with empathy rather than prove their intellect.',
            zh: '纳德拉彻底废除了残酷的内部末位淘汰排名与官僚傲慢，引入了卡罗尔·德韦克的“成长型思维”。微软文化从“无所不知（Know-it-all）”转变为“无所不学（Learn-it-all）”。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'acquired-standard-oil',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'Standard Oil: The Genesis of Modern Monopoly',
    titleZh: '标准石油：约翰·洛克菲勒与现代工业垄断的起源范式',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/standard-oil',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ6618293719.mp3',
    readingMinutes: 32,
    tags: ['商业史', '垄断', '供应链', '纵向一体化'],
    summary: '现代工业垄断的教科书级案例。深入解析洛克菲勒如何避开风险极大的源头采油，转而通过控制中游管道、铁路运力回扣与精炼工艺，建立起统治全球 90% 石油供应的超级商业帝国。',
    coreInsight: '供应链中控制权最高的地方，往往不是原材料生产端，而是连接生产与消费的物流与精炼节点。',
    htmlSections: [
      {
        heading: '第一章：不钻井，只做炼油与物流瓶颈',
        paragraphs: [
          {
            en: 'Rockefeller observed that drilling for oil was wild speculation: wells dried up and boomtowns collapsed. He decided to focus on refining and distribution, where cold efficiency created predictable cash flow.',
            zh: '洛克菲勒敏锐地发现采油是一场狂热的投机赌博：油井随时可能枯竭，小镇转瞬即逝。他决定只聚焦于炼油与运输分销——在这里，冷酷的极致效率能带来稳定、可预测的庞大现金流。'
          },
          {
            en: 'By guaranteeing massive, regular trainloads of kerosene to railroad barons like Vanderbilt, Standard Oil extracted massive volume rebates, starving smaller competitors of fair shipping rates.',
            zh: '通过向范德比尔特等铁路大亨保证巨量且稳定的煤油运输配额，标准石油换取了极其惊人的运费折扣，使得中小竞争对手在物流成本上被系统性绞杀。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'acquired-lvmh',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'LVMH: Bernard Arnault and the Luxury Conglomerate Machine',
    titleZh: 'LVMH 帝国：伯纳德·阿尔诺与奢侈品集团化运作机器',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/lvmh',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ5198273612.mp3',
    readingMinutes: 29,
    tags: ['商业史', '并购', '资本运作', '中台战略'],
    summary: '资本狼性与艺术格调的终极结合。揭示阿尔诺如何将法国散落的百年家族作坊通过兼并收购组装成一艘跨国航母，利用全球顶级地段的谈判权与共享中台实现降维打击。',
    coreInsight: '奢侈品多品牌集团的最大优势在于对全球顶级商圈物业与供应链议价权的绝对垄断。',
    htmlSections: [
      {
        heading: '第一章：狼性收购与迪奥的起点',
        paragraphs: [
          {
            en: 'Bernard Arnault used family capital and French state subsidies to acquire a bankrupt textile conglomerate solely to seize Christian Dior. He ruthlessly liquidated the rest of the business.',
            zh: '年轻的阿尔诺动用家族资金并借助法国政府纾困补贴收购了一家濒临破产的纺织工业集团，其真实目标只有一个——拿下旗下的克里斯汀·迪奥（Christian Dior）。得手后，他果断剥离变卖了其余冗余资产。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'acquired-nintendo',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'Nintendo: Lateral Thinking with Withered Technology',
    titleZh: '任天堂：百年京都花札厂与“枯萎技术的水平思考”',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/nintendo',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ4918273615.mp3',
    readingMinutes: 30,
    tags: ['商业哲学', '创意产业', '硬件设计', '常青品牌'],
    summary: '从 1889 年的手工花札小作坊到现代游戏王国。传奇工程师横井军平提出的核心哲学：不要追逐昂贵前沿的高精尖硬件，而是把已经成熟、廉价且成熟的技术（枯萎技术）用极其新奇的玩法重新组合。',
    coreInsight: '技术的终极价值在于赋予用户的非凡体验，而非芯片参数的纸面军备竞赛。',
    htmlSections: [
      {
        heading: '第一章：枯萎技术的奇迹（Game Boy 与 Wii）',
        paragraphs: [
          {
            en: 'When Sony and Sega introduced color handhelds with backlights, Gunpei Yokoi insisted that the Game Boy use an ancient monochrome screen to guarantee 30 hours of battery life. It crushed the competition.',
            zh: '当索尼与世嘉推出昂贵、耗电的彩色背光掌机时，横井军平力排众议坚持 Game Boy 采用极其廉价成熟的黑白液晶屏，换来了惊人的 30 小时超长续航，将竞品打得体无完肤。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'acquired-amazon-aws',
    sourceId: 'acquired',
    sourceName: 'Acquired',
    category: '商业',
    lang: 'en',
    title: 'Amazon & AWS: The Primitives Machine',
    titleZh: '亚马逊与 AWS：从内部最痛基础设施到全球商业收费机',
    author: 'Ben Gilbert & David Rosenthal',
    url: 'https://www.acquired.fm/episodes/amazon-web-services',
    audioUrl: 'https://chrt.fm/track/8D516/traffic.megaphone.fm/ACQ3817264519.mp3',
    readingMinutes: 34,
    tags: ['商业模型', '云计算', '规模效应', '飞轮效应'],
    summary: '解密贝索斯如何将企业内部最痛苦的成本中心（庞大无序的计算服务器与仓储系统）解构为极小原子服务（Primitives），并对外商业化，变成现代整个互联网的底层收税机器。',
    coreInsight: '将自己的核心成本中心转化为面向整个行业的盈利平台，是商业史上最伟大的飞轮设计。',
    htmlSections: [
      {
        heading: '第一章：原子化积木（Primitives）的哲学',
        paragraphs: [
          {
            en: 'Andy Jassy and Jeff Bezos decided not to build finished monolithic applications for customers, but rather elemental building blocks: storage (S3), compute (EC2), and databases.',
            zh: '安迪·贾西与贝索斯确立了 AWS 的底层信条：不为客户开发笨重僵化的完整应用，而是提供极其精炼的基础原子积木——存储（S3）、计算（EC2）与数据库。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'econtalk-andreessen-software',
    sourceId: 'econtalk',
    sourceName: 'EconTalk',
    category: '商业',
    lang: 'en',
    title: 'Marc Andreessen on Why Software Is Eating the World',
    titleZh: '马克·安德森长谈：为什么软件依然在以零边际成本吞噬世界',
    author: 'Russ Roberts & Marc Andreessen',
    url: 'https://www.econtalk.org/marc-andreessen-on-why-software-is-eating-the-world/',
    audioUrl: 'https://traffic.libsyn.com/econtalk/andreessen.mp3',
    readingMinutes: 26,
    tags: ['经济学', '技术扩散', '生产力', '边际成本'],
    summary: '网景创始人兼 a16z 领航人安德森对话斯坦福经济学学者 Russ Roberts，系统性剖析为什么各行各业（从零售、影视到医疗、教育）最终都会不可逆转地被代码与自动化重构。',
    coreInsight: '物理世界的摩擦力极其昂贵，而代码的复制与分发边际成本趋近于零，这一经济学基本公理决定了软件的无限渗透力。',
    htmlSections: [
      {
        heading: '第一章：实体资产的沉重与软件的流动性',
        paragraphs: [
          {
            en: 'Traditional businesses carry heavy physical baggage—factories, leases, and local inventory. Software converts physical processes into logic, collapsing reproduction costs to zero.',
            zh: '传统实体商业背负着极其沉重的物理包袱——厂房、长租合同与线下库存积压。而软件把所有的物理交互流程抽象为逻辑代码，将边际再生产成本彻底压缩至零。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'notboring-berkshire-playbook',
    sourceId: 'notboring',
    sourceName: 'Not Boring',
    category: '商业',
    lang: 'en',
    title: 'Compounding Crazy: The Berkshire Hathaway Playbook',
    titleZh: '复利机器：巴菲特伯克希尔哈撒韦的负成本浮存金与投资心法',
    author: 'Packy McCormick',
    url: 'https://www.notboring.co/p/compounding-crazy',
    readingMinutes: 24,
    tags: ['投资哲学', '保险浮存金', '复利', '资本配置'],
    summary: '万字长文解剖巴菲特与芒格的资本帝国真相。解释为什么普通散户无法模仿巴菲特：因为巴菲特的背后拥有一台由保险业务（National Indemnity、GEICO）源源不断输送的、年化借款利率低于零的“负成本浮存金”机器。',
    coreInsight: '超额复利的秘密不仅在于选股眼光，更在于拥有永不需要在市场恐慌时被迫赎回的超长期资本结构。',
    htmlSections: [
      {
        heading: '第一章：浮存金（Float）的真正魔力',
        paragraphs: [
          {
            en: 'Insurance float is money that does not belong to Berkshire, but that it holds until claims are paid. Because Berkshire’s underwriting is consistently profitable, this money has an effective cost below zero.',
            zh: '保险浮存金本质上是一笔不属于伯克希尔的暂扣资金，在理赔发生前由其全权管理。因为伯克希尔的承保常年维持盈余，这笔规模数千亿美元的资金实质借贷成本甚至低于零。'
          }
        ]
      }
    ]
  },

  // ==========================================
  // 二、 大脑、行为心理与认知盲区 (11-20)
  // ==========================================
  {
    idSuffix: 'hiddenbrain-tunnel-vision',
    sourceId: 'hiddenbrain',
    sourceName: 'Hidden Brain',
    category: '思想',
    lang: 'en',
    title: 'You 2.0: Tunnel Vision and the Scarcity Trap',
    titleZh: '隐秘大脑：管道视野与稀缺陷阱——为什么匮乏感会锁死认知带宽',
    author: 'Shankar Vedantam',
    url: 'https://www.hiddenbrain.org/podcast/you-2-0-tunnel-vision/',
    audioUrl: 'https://traffic.simplecast.com/audio-tunnel-vision.mp3',
    readingMinutes: 22,
    tags: ['认知心理', '稀缺理论', '注意力管理', '行为经济学'],
    summary: '结合普林斯顿大学埃尔达·沙菲尔与哈佛大学穆来纳森的开创性研究，揭示人类在极度缺钱或极度缺时间时，大脑会自动开启狭窄的“管道视野”，彻底丧失长期理性规划的能力，陷入恶性循环。',
    coreInsight: '贫困或过度忙碌不仅是外部资源的匮乏，更是对大脑生理认知带宽（Cognitive Bandwidth）的强制掠夺。',
    htmlSections: [
      {
        heading: '第一章：注意力被强制征税的心理学机制',
        paragraphs: [
          {
            en: 'When an immediate crisis looms—rent due tomorrow, an impending deadline—our attention focuses like a laser on the immediate emergency. This tunnel vision helps us survive today, but blinds us to the train coming tomorrow.',
            zh: '当眼前突发紧急危机时——明天的房租、近在咫尺的交工期限——人类的大脑会自动像激光一样死死聚焦于眼前的火灾。这种“管道视野”能帮你应付今天，却让你对明天迎面撞来的火车彻底视而不见。'
          },
          {
            en: 'Laboratory experiments show that simply prompting low-income individuals to think about unexpected car repair bills causes their cognitive performance on unrelated fluid intelligence tests to drop by 13 IQ points.',
            zh: '心理学严谨对照实验证明：仅仅让低收入人群思考一笔意料之外的高昂修车账单，他们在与此毫无关联的流体智力测试中的得分就会骤降 13 分，相当于整夜失眠造成的大脑功能损害。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'hiddenbrain-explanatory-depth',
    sourceId: 'hiddenbrain',
    sourceName: 'Hidden Brain',
    category: '思想',
    lang: 'en',
    title: 'The Illusion of Explanatory Depth: Why We Think We Understand',
    titleZh: '解释深度错觉：为什么我们自以为无所不知，其实经不起一句追问',
    author: 'Shankar Vedantam',
    url: 'https://www.hiddenbrain.org/podcast/the-illusion-of-explanatory-depth/',
    readingMinutes: 20,
    tags: ['认知偏差', '第一性原理', '元认知', '批判性思维'],
    summary: '揭露人类最普遍也最隐蔽的认知狂妄。我们每天对抽水马桶、拉链乃至复杂的宏观经济与地缘政策高谈阔论，自以为洞悉一切，但一旦要求拿出一张白纸详细画出齿轮咬合或机械流体力学原理，绝大多数人瞬间哑口无言。',
    coreInsight: '将“熟悉一个名词的存在”误认为“理解其内在因果机制”，是人类几乎所有盲目争论与错误决策的根源。',
    htmlSections: [
      {
        heading: '第一章：拉链实验与戳破自负的瞬间',
        paragraphs: [
          {
            en: 'Psychologists Frank Keil and Leonid Rozenblit asked people to rate their understanding of everyday mechanisms on a scale of 1 to 7. Most people rated themselves 5 or 6. Then they asked: "Please write down step-by-step how a zipper works."',
            zh: '心理学家弗兰克·凯尔让受试者对拉链、马桶等日常物件的工作原理自评理解程度（1到7分），多数人自信地给自己打了5到6分的高分。随后研究者给出一张白纸：“请分步骤详尽画出拉链卡齿是如何完成咬合与分离的。”'
          },
          {
            en: 'People immediately stumbled, realized their profound ignorance, and significantly downgraded their ratings. We store very little knowledge in our heads; we borrow understanding from the community of knowledge around us.',
            zh: '人们瞬间语塞、面红耳赤，终于意识到自己对朝夕相处的事物其实一无所知。人类的大脑其实极少存储具体的机制细节，我们只是自负地向身处的知识共同体“借用”了知晓的假象。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'hiddenbrain-ostrich-effect',
    sourceId: 'hiddenbrain',
    sourceName: 'Hidden Brain',
    category: '思想',
    lang: 'en',
    title: 'The Ostrich Effect: Why We Turn a Blind Eye to Bad News',
    titleZh: '鸵鸟效应：为什么面对亏损与隐疾，人类会主动选择“防御性无知”',
    author: 'Shankar Vedantam',
    url: 'https://www.hiddenbrain.org/podcast/the-ostrich-effect/',
    readingMinutes: 21,
    tags: ['情绪管理', '逃避心理', '投资心理学', '行为科学'],
    summary: '解剖为什么股民在股市大跌时极少登录账户查看亏损，为什么身体明显异常的人会疯狂拖延体检。节目深入探讨了人类大脑为了保护当下的情绪舒适，如何系统性启动“防御性无知（Willful Ignorance）”。',
    coreInsight: '信息具有双重属性：它既是做决策的工具，也是引起痛苦或快感的情绪消费品。',
    htmlSections: [
      {
        heading: '第一章：不想知道真相的本能',
        paragraphs: [
          {
            en: 'Behavioral economists found that investors check their online portfolios far less frequently when the market drops than when it rises. People do not seek truth; they seek psychological shielding from emotional pain.',
            zh: '行为经济学家通过追踪百万级证券账户发现：当大盘暴跌时，投资者登录系统的频率断崖式下降；而当行情大涨时则频繁查看。人类追逐的往往不是客观真理，而是躲避情绪痛苦的心理护盾。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'hiddenbrain-curse-knowledge',
    sourceId: 'hiddenbrain',
    sourceName: 'Hidden Brain',
    category: '思想',
    lang: 'en',
    title: 'The Curse of Knowledge: Why Communication Fails',
    titleZh: '知识的诅咒：为什么越是专家，越难把简单道理讲明白',
    author: 'Shankar Vedantam',
    url: 'https://www.hiddenbrain.org/podcast/the-curse-of-knowledge/',
    readingMinutes: 19,
    tags: ['沟通心理', '组织管理', '认知鸿沟', '教育学'],
    summary: '经典敲击者实验（Tappers and Listeners）的深度复盘。一旦你脑海中已经听到了那段熟悉的旋律，你就再也无法体会一个从来没听过这首歌的人面对你敲击桌面的枯燥声音时那种茫然无知的感受。',
    coreInsight: '知识最大的副产品，是彻底剥夺了你还原“无知状态”的心智能力。',
    htmlSections: [
      {
        heading: '第一章：桌子上的孤单敲击声',
        paragraphs: [
          {
            en: 'In Elizabeth Newton’s famous experiment, tappers were assigned well-known songs like "Happy Birthday" to tap on a table. Tappers estimated listeners would guess 50% correctly. The actual success rate was barely 2.5%.',
            zh: '在斯坦福大学著名的心理学实验中，敲击者被要求在桌上用手指敲出《祝你生日快乐》的节奏。敲击者自信地预测听众至少能猜对 50%，而现实的真实猜中率只有微不足道的 2.5%。'
          },
          {
            en: 'The tappers were incredulous. Because the song was playing vividly inside their own heads, they could not imagine that to the listener, it sounded like random Morse code.',
            zh: '敲击者感到不可思议。因为他们自己的大脑里伴奏着完整的交响乐旋律，他们根本无法想象在听众耳朵里，这只是一串毫无意义的木头敲击杂音。职场管理者与员工的沟通错位概莫能外。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'freakonomics-upside-quitting',
    sourceId: 'freakonomics',
    sourceName: 'Freakonomics Radio',
    category: '思想',
    lang: 'en',
    title: 'The Upside of Quitting: Why Walking Away Is Rational',
    titleZh: '放弃的积极意义：为什么适时抽身止损才是顶级高手的理性',
    author: 'Stephen J. Dubner',
    url: 'https://freakonomics.com/podcast/the-upside-of-quitting-rebroadcast/',
    readingMinutes: 25,
    tags: ['决策科学', '沉没成本', '机会成本', '人生哲学'],
    summary: '从小社会就灌输我们“永不放弃是成功的唯一秘诀”，但经济学家认为，人类之所以常常困在糟糕的婚姻、失败的事业和亏损的项目里，完全源于对沉没成本的盲目执念。果断放弃才是释放机会成本的终极武器。',
    coreInsight: '你花在沉没错误上的每一秒钟，都是在剥夺你未来奔向正确机遇的机会成本。',
    htmlSections: [
      {
        heading: '第一章：被道德化的“坚持到底”',
        paragraphs: [
          {
            en: 'Society treats quitting as a moral failure. But economists argue that every dollar and every hour you pour into an underperforming project has an opportunity cost: what else could you be doing with that time?',
            zh: '人类社会常常把“放弃”等同于品格上的软弱与道德失败。但经济学家指出，你继续砸在一个平庸项目上的每一块钱和每一小时，都有着沉重的机会成本——如果你抽身离开，原本能创造多大的价值？'
          },
          {
            en: 'Sunk cost fallacy makes people cling to losing investments just to avoid admitting defeat. High performers quit fast and quit often when the expected return turns negative.',
            zh: '沉没成本谬误让人死抱住亏损的泥潭不放，仅仅是为了逃避“承认自己失败”的心理刺痛。而真正高阶的决策者一旦发现预期回报转负，便会极其冷静、高频且果断地止损抽身。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'freakonomics-gender-pay-gap',
    sourceId: 'freakonomics',
    sourceName: 'Freakonomics Radio',
    category: '思想',
    lang: 'en',
    title: 'The True Story of the Gender Pay Gap',
    titleZh: '男女薪酬差距真相：哈佛诺奖得主 Claudia Goldin 谈“贪婪工作”与工时惩罚',
    author: 'Stephen J. Dubner & Claudia Goldin',
    url: 'https://freakonomics.com/podcast/the-true-story-of-the-gender-pay-gap/',
    readingMinutes: 27,
    tags: ['劳动经济学', '诺贝尔奖', '职场机制', '社会制度'],
    summary: '哈佛大学劳动经济学泰斗、诺贝尔经济学奖得主克劳迪娅·戈尔丁专访。打破传统的道德口水战，用详实微观经济数据证明：现代高端行业薪酬差距的核心不在显性歧视，而在“贪婪工作（Greedy Jobs）”对弹性工时的高额惩罚。',
    coreInsight: '薪酬差距的真正拐点在第一个孩子降生之后，商业机构对“随时待命（80小时工时）”给予的非线性超额奖励拉开了终极鸿沟。',
    htmlSections: [
      {
        heading: '第一章：贪婪工作与非线性报酬',
        paragraphs: [
          {
            en: 'In professions like corporate law and investment banking, someone who works 80 hours a week earns not twice as much, but four times as much as someone working 40 hours. The job is greedy.',
            zh: '在投行、顶级律所等行业，每周工作 80 小时的人拿到的薪水往往不是 40 小时者的两倍，而是四倍甚至更多。这类职位对个人的时间索求极其“贪婪（Greedy Jobs）”。'
          },
          {
            en: 'Because society still expects mothers to take disproportionate responsibility for childcare emergencies, women are priced out of greedy roles and forced into flexible roles with severe pay penalties.',
            zh: '由于社会分工与家庭结构往往迫使母亲承担更多突发的育儿照料责任，女性被迫退出这些贪婪职位，转而选择工时灵活但遭遇巨大薪酬折价的岗位。解决方案是推进工作岗位的可替代化（如药剂师行业）。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'freakonomics-in-praise-maintenance',
    sourceId: 'freakonomics',
    sourceName: 'Freakonomics Radio',
    category: '思想',
    lang: 'en',
    title: 'In Praise of Maintenance: Why We Neglect Upkeep',
    titleZh: '赞美维护者：为什么人类社会狂热奖励从0到1的发明，却系统性漠视维护',
    author: 'Stephen J. Dubner',
    url: 'https://freakonomics.com/podcast/in-praise-of-maintenance-rebroadcast/',
    readingMinutes: 23,
    tags: ['系统论', '基础设施', '激励机制', '组织运转'],
    summary: '为什么所有政治家都喜欢为新大桥剪彩，却极少拨款给桥梁刷防锈漆？为什么科技圈热衷发明新框架，却没人愿意重构老代码？从经济学激励机制剖析现代基础设施老化与系统性技术债务的底层根源。',
    coreInsight: '文明的延续 90% 依赖于日常无趣的维护，但人类社会的激励机制却 100% 倾斜给了昙花一现的从0到1。',
    htmlSections: [
      {
        heading: '第一章：剪彩狂热与防锈漆困境',
        paragraphs: [
          {
            en: 'Innovation gets the glory, the TED talks, and the venture capital. But maintenance keeps planes in the sky, sewer lines running, and ancient power grids from catching fire.',
            zh: '创新总能独揽所有的聚光灯、TED 演讲荣誉与风险投资的追捧。然而，真正让飞机安全巡航、排污系统正常运转、陈旧电网不至于起火崩塌的，全部依赖于沉默寡言的日常维护者。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'huberman-master-sleep',
    sourceId: 'hubermanlab',
    sourceName: 'Huberman Lab',
    category: '思想',
    lang: 'en',
    title: 'Master Your Sleep & Be More Alert When Awake',
    titleZh: '掌控睡眠与清醒节律：斯坦福神经科学家谈生物钟的生理学底层机制',
    author: 'Andrew Huberman',
    url: 'https://www.hubermanlab.com/episode/master-your-sleep-and-be-more-alert-when-awake',
    readingMinutes: 30,
    tags: ['脑科学', '神经生物学', '昼夜节律', '身体协议'],
    summary: '全网播放破千万的健康奠基之作。从视网膜神经节细胞（ipRGCs）对早晨斜射阳光的物理光波感知、腺苷（Adenosine）压力积累到褪黑素周期，把晦涩的神经解剖学转化为清晰硬核的日常生理协议。',
    coreInsight: '睡眠质量的决定时刻不是你上床闭眼的瞬间，而是你早晨起床后前 30 分钟做了什么。',
    htmlSections: [
      {
        heading: '第一章：清晨光照与昼夜节律计时器',
        paragraphs: [
          {
            en: 'Viewing morning sunlight within 30 to 60 minutes of waking triggers a natural pulse of cortisol, setting an internal timer that dictates when you will feel sleepy approximately 16 hours later.',
            zh: '起床后 30 到 60 分钟内走出户外直面自然阳光，会激活视网膜神经节细胞，给下丘脑视交叉上核（SCN）校准时钟，触发健康皮质醇脉冲，并自动定下约 16 小时后释放褪黑素的生理倒计时。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'huberman-dopamine-focus',
    sourceId: 'hubermanlab',
    sourceName: 'Huberman Lab',
    category: '思想',
    lang: 'en',
    title: 'Controlling Your Dopamine for Motivation, Focus & Satisfaction',
    titleZh: '掌控多巴胺：神经回路如何决定你的驱动力、耐受度与专注极限',
    author: 'Andrew Huberman',
    url: 'https://www.hubermanlab.com/episode/controlling-your-dopamine-for-motivation-focus-and-satisfaction',
    readingMinutes: 32,
    tags: ['神经科学', '多巴胺', '注意力', '动机机制'],
    summary: '讲透多巴胺基线（Baseline）与脉冲峰值（Peak）之间的精妙天平。解释为什么高强度的多巴胺刺激（手机刷短视频、糖分、赌博）必然导致基线暴跌与长期的虚无抑郁，教你如何利用间歇性可变奖励保持长久干劲。',
    coreInsight: '多巴胺不是快乐分子的终点，而是对快乐期待的渴求货币；每一次人为激增的峰值，都必须用未来基线的沉降来偿还。',
    htmlSections: [
      {
        heading: '第一章：基线法则与快乐的债务',
        paragraphs: [
          {
            en: 'Dopamine works like a wave pool. When you experience a massive artificial peak from a quick reward, your baseline level drops below where it was before. This drop is experienced as cravings, lethargy, and emptiness.',
            zh: '多巴胺的运作机制就像一个造浪池。当你通过即时快感制造出一个巨大的虚假脉冲峰值时，随之而来的回落必然会跌破你原有的基线水平。这种低谷在主观体验上就是强烈的成瘾渴求、倦怠与虚无。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'hiddenbrain-feelings-smarter',
    sourceId: 'hiddenbrain',
    sourceName: 'Hidden Brain',
    category: '思想',
    lang: 'en',
    title: 'How Feelings Make Us Smarter: The Science of Emotional Intelligence',
    titleZh: '情绪如何让我们更聪明：耶鲁大学校长 Peter Salovey 谈情商与理性的协同',
    author: 'Shankar Vedantam & Peter Salovey',
    url: 'https://www.hiddenbrain.org/podcast/how-feelings-make-us-smarter/',
    readingMinutes: 22,
    tags: ['情绪智力', '心理学', '认知决策', '人际洞察'],
    summary: '当代情绪智商（EQ）概念的奠基人亲述。打破“理性至高无上、情绪皆是干扰”的机械唯物偏见，证明情绪是大脑在面对极度复杂、信息不完全的现实博弈时，调动潜意识进行的高维综合概率运算。',
    coreInsight: '情商不是圆滑世故，而是把身体的情绪反馈作为精准的情报输入，与理性分析协同决策。',
    htmlSections: [
      {
        heading: '第一章：情绪作为高速运算情报',
        paragraphs: [
          {
            en: 'Emotions are not evolutionary glitches meant to derail rationality. They are sophisticated, high-speed data feeds that inform us about threats, opportunities, and social alignments before our conscious mind finishes calculating.',
            zh: '情绪绝不是阻碍理性思考的演化缺陷。它们是高度精密的、高速运转的生理数据流，能在我们的意识逻辑慢条斯理完成运算之前，极其迅速地向全身通报潜在的威胁、机遇与人际博弈信号。'
          }
        ]
      }
    ]
  },

  // ==========================================
  // 三、 科学哲学、前沿思考与底层物理 (21-30)
  // ==========================================
  {
    idSuffix: 'lex-musk-physics',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'Elon Musk: Rockets, Combustion Physics, and First Principles',
    titleZh: '埃隆·马斯克硬核专访：猛禽发动机燃烧室热力学与第一性原理工程',
    author: 'Lex Fridman & Elon Musk',
    url: 'https://lexfridman.com/elon-musk-4-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_elon_musk_4.mp3',
    readingMinutes: 38,
    tags: ['航天工程', '物理学', '第一性原理', '制造业'],
    summary: '剥离一切公关话术与八卦炒作。长达两个半小时纯粹探讨全流量分级燃烧循环（Full-flow staged combustion）甲烷发动机的冶金极限、燃烧室热声不稳定性以及如何把火箭单公斤入轨成本从数万美元干到几十美元。',
    coreInsight: '第一性原理意味着把事物还原到最基础的物理规律本身：原材料的现货大宗价格是多少，把它们组合起来所需的热力学能量是多少，中间的所有差价都是人为摩擦与低效。',
    htmlSections: [
      {
        heading: '第一章：猛禽发动机与全流量分级燃烧的物理极限',
        paragraphs: [
          {
            en: 'Musk explains why SpaceX chose full-flow staged combustion for Raptor: running oxygen-rich and fuel-rich preburners simultaneously keeps temperatures lower while maximizing chamber pressure past 300 atmospheres.',
            zh: '马斯克详细解释了为什么 SpaceX 执意为猛禽发动机选择最艰难的全流量分级燃烧路线：同时运行富氧与富燃双预燃室，能在将燃烧室主压力推向 300 个大气压绝顶极限的同时，维持较低的泵涡轮工作温度。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-kotkin-stalin-ussr',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'Stephen Kotkin: Stalin, the Soviet Union, and Geopolitics',
    titleZh: '斯蒂芬·科特金长谈：斯大林生平、苏联崩溃真相与俄罗斯千年地缘安全焦虑',
    author: 'Lex Fridman & Stephen Kotkin',
    url: 'https://lexfridman.com/stephen-kotkin-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_stephen_kotkin.mp3',
    readingMinutes: 42,
    tags: ['大历史', '极权主义', '苏联历史', '地缘政治'],
    summary: '历史学界公认最高水准的访谈之一。斯大林最权威的传记作者科特金，用接近 4 个小时颠覆了“斯大林只是疯子暴君”的单薄脸谱，从布尔什维克狂热的理想主义、沙皇农奴制遗产到东欧大平原无险可守的地理宿命，讲透了大国历史悲剧的必然因果。',
    coreInsight: '极权体制最恐怖的不是由贪婪的恶棍操盘，而是由坚信自己掌握了历史终极真理、克勤克俭却毫不犹疑消灭异端的虔诚信徒来操盘。',
    htmlSections: [
      {
        heading: '第一章：虔诚狂热的教徒而非玩弄权术的无赖',
        paragraphs: [
          {
            en: 'Kotkin argues that Stalin was not an opportunist who betrayed Marxism; he was a true believer who read thousands of pages of Marxist theory, genuinely convinced that collectivization was the only path to a communist utopia.',
            zh: '科特金深刻指出：斯大林绝非背叛马克思主义的投机政客，而是一个终身手不释卷、批阅海量理论手稿的狂热信徒。他发自真心地坚信：唯有以铁腕推行农业集体化、消灭富农阶级，才是通往无阶级共产主义乌托邦的唯一真理之途。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-penrose-physics-consciousness',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'Sir Roger Penrose: Black Holes, the Big Bang, and Consciousness',
    titleZh: '罗杰·彭罗斯爵士：黑洞奇点、共形循环宇宙学与非可计算意识',
    author: 'Lex Fridman & Roger Penrose',
    url: 'https://lexfridman.com/roger-penrose-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_roger_penrose.mp3',
    readingMinutes: 40,
    tags: ['理论物理', '宇宙学', '诺贝尔奖', '意识哲学'],
    summary: '霍金长期合作者、诺贝尔物理学奖得主彭罗斯亲自解构：宇宙在大爆炸之前究竟是什么？他的“共形循环宇宙学（CCC模型）”如何打破热力学死局；以及为什么人类大脑的直觉与理解力，绝非基于传统图灵可计算算法所能穷尽。',
    coreInsight: '人类对数学真理的领悟包含了非可计算的量子客观崩塌过程，算法可以模拟计算，但无法自动诞生理解。',
    htmlSections: [
      {
        heading: '第一章：大爆炸之前的永恒回响',
        paragraphs: [
          {
            en: 'Penrose explains Conformal Cyclic Cosmology: in the remote future when all matter evaporates into massless photons, time and distance lose meaning. This cold, infinite expanse is mathematically identical to the Big Bang singularity of the next Aeon.',
            zh: '彭罗斯深入推导共形循环宇宙学（CCC）：在遥远未来的宇宙终局，当所有物质均衰变蒸发为静止质量为零的光子时，时间和空间尺度将彻底失效。这种极度冰冷、无限辽阔的几何形态，在数学拓扑上与下一个宇宙纪元（Aeon）的大爆炸奇点完全等价。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-bezos-amazon-blueorigin',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'Jeff Bezos: Blue Origin, Amazon, and One-Way vs. Two-Way Doors',
    titleZh: '杰夫·贝索斯罕见长谈：单向门与双向门决策机制、蓝色起源与组织真谛',
    author: 'Lex Fridman & Jeff Bezos',
    url: 'https://lexfridman.com/jeff-bezos-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_jeff_bezos.mp3',
    readingMinutes: 36,
    tags: ['组织决策', '航天', '领导力', '第一性原理'],
    summary: '贝索斯退任亚马逊 CEO 后最深刻的一次对话。完整拆解为何大公司往往在内部决策上窒息：因为官僚体制习惯用管理“单向门（不可逆重大决策）”的繁重审查流程，去惩罚原本可以快速试错的“双向门（可逆轻量决策）”。',
    coreInsight: '绝大多数商业决策都是双向门，如果走进去发现错了，退出来即可；把所有决策都当作单向门审慎对待，是组织丧失活力的根本原因。',
    htmlSections: [
      {
        heading: '第一章：六页备忘录与禁止 PPT 的力量',
        paragraphs: [
          {
            en: 'Bezos explains why Amazon banned PowerPoint: PowerPoint allows presenters to hide sloppy thinking behind bullet points. A six-page narrative memo forces the author to construct an unbroken chain of logical reasoning.',
            zh: '贝索斯详述为什么亚马逊彻底禁止 PPT 汇报：PPT 充斥着浮躁的项目符号，容易让演讲者隐藏松散混乱的底层思考。而长达六页的纯文字叙事备忘录，强制作者在下笔时必须构筑一条严丝合缝的逻辑因果链。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-carlin-civilization',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'Dan Carlin: Hardcore History and the Fragility of Civilization',
    titleZh: '丹·卡林深度对谈：硬核历史、至暗时刻与人类文明的极端脆弱性',
    author: 'Lex Fridman & Dan Carlin',
    url: 'https://lexfridman.com/dan-carlin-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_dan_carlin.mp3',
    readingMinutes: 35,
    tags: ['历史哲学', '战史', '文明兴衰', '人性考验'],
    summary: '两大播客巨匠的火花对撞。从古罗马灭亡、一战堑壕战精神崩溃到现代核威慑平衡，深入拷问：如果现代水电气与粮食供应链中断三天，维系人类道德与法律的文明薄纱究竟会在几小时内撕裂？',
    coreInsight: '文明不是坚不可摧的大理石丰碑，而是悬在一根随时可能被恐慌斩断的纤细蛛丝上。',
    htmlSections: [
      {
        heading: '第一章：核冬天与堑壕战的深渊',
        paragraphs: [
          {
            en: 'Carlin notes that ancient civilizations thought their golden ages would last forever. But all it takes is a breakdown of trust and supply lines, and ordinary citizens are thrust into prehistoric barbarism within weeks.',
            zh: '卡林感叹：古代所有鼎盛时期的帝国都盲目坚信自己的黄金时代将万世长存。但现实一次次证明：只要信任与供应链链条断裂，遵纪守法的现代市民便会在几周内被抛入野蛮血腥的丛林法则之中。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-dawkins-selfish-gene',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'Richard Dawkins: The Selfish Gene, Evolution, and Memetics',
    titleZh: '理查德·道金斯：自私的基因、演化盲眼钟表匠与文化模因复制',
    author: 'Lex Fridman & Richard Dawkins',
    url: 'https://lexfridman.com/richard-dawkins-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_richard_dawkins.mp3',
    readingMinutes: 34,
    tags: ['演化生物学', '基因哲学', '模因论', '无神论'],
    summary: '当代演化生物学教父道金斯长访谈。彻底粉碎以人类为中心的宇宙自大感：肉体与个体不过是临时载具与工具人，真正跨越数十亿年时空不朽流传的，是那些只顾自我复制的代码单元——基因与文化模因（Memes）。',
    coreInsight: '自然界并不存在所谓的“物种整体利益最大化”，所有看似高尚的利他协作，底层都是基因为了自身复制概率进行的残酷冷血算计。',
    htmlSections: [
      {
        heading: '第一章：盲眼钟表匠与非设计的秩序',
        paragraphs: [
          {
            en: 'Dawkins reminds us that evolution has no foresight, no blueprint, and no final destination. Complex adaptations like the eye emerge through cumulative, non-random survival of random mutations.',
            zh: '道金斯告诫我们：演化没有任何预见性、没有任何终极蓝图，也没有任何道德旨归。像人眼这样精妙绝伦的器官，纯粹是亿万年间由随机突变所产生的无序差异，在自然选择的漏斗中经过非随机累积筛选而偶然诞生的奇迹。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-bird-oppenheimer-tragedy',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'Kai Bird: J. Robert Oppenheimer, the Manhattan Project, and the Atomic Tragedy',
    titleZh: '普利策奖得主凯·伯德：奥本海默传、曼哈顿工程与盗火者的道德炼狱',
    author: 'Lex Fridman & Kai Bird',
    url: 'https://lexfridman.com/kai-bird-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_kai_bird.mp3',
    readingMinutes: 32,
    tags: ['历史传记', '科学伦理', '冷战', '政治悲剧'],
    summary: '电影《奥本海默》原著传记作者亲述。复盘现代“普罗米修斯”如何在极端爱国主义与科学至上的双重驱动下造出毁灭人类的大杀器，并在冷战麦卡锡主义的狂热猎巫中被体制残忍抛弃与审判的千古悲剧。',
    coreInsight: '科学家最深重的悲哀，在于他们以为自己掌握了造物的终极力量，却在官僚与地缘政治的权力杠杆面前脆弱得宛如蝼蚁。',
    htmlSections: [
      {
        heading: '第一章：洛斯阿拉莫斯的三位一体试爆',
        paragraphs: [
          {
            en: 'Bird recounts Oppenheimer standing in the desert dawn of July 1945, seeing the blinding flash that eclipsed the sun. He knew instantly that humanity had crossed a threshold from which there was no return.',
            zh: '伯德深情回忆起 1945 年 7 月黎明荒漠里的奥本海默。当那团遮蔽太阳的毁灭强光吞没天际时，他瞬间清醒地明白：全人类已经踏过了一条再也无法回头的深渊门槛。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'dwarkesh-aschenbrenner-situational-awareness',
    sourceId: 'dwarkesh',
    sourceName: 'Dwarkesh Podcast',
    category: '访谈',
    lang: 'en',
    title: 'Leopold Aschenbrenner: Situational Awareness and the National Security Paradigm',
    titleZh: '前 OpenAI 对齐主管详尽推演：态势感知、2027算力大爆发与国家安全范式',
    author: 'Dwarkesh Patel & Leopold Aschenbrenner',
    url: 'https://www.dwarkeshpatel.com/p/leopold-aschenbrenner',
    readingMinutes: 38,
    tags: ['态势感知', '前沿推演', '国家安全', '基础设施'],
    summary: '全网引发巨大震动的万字推演对谈。深入探讨为什么未来的超级计算集群将遭遇前所未有的电网负荷极限、为什么算力中心终将成为大国地缘博弈的绝对战略要塞。',
    coreInsight: '当技术指数曲线与物理世界的电网、变压器和国家军工保密体系迎面相撞时，一切传统的民用商业模式都将被彻底重写。',
    htmlSections: [
      {
        heading: '第一章：物理世界的电网硬约束',
        paragraphs: [
          {
            en: 'Aschenbrenner argues that the limiting factor for supercomputing is not capital or algorithms, but physical power: moving from megawatts to gigawatts requires dedicated nuclear plants and transmission line overhauls.',
            zh: '阿申布伦纳论证道：超级计算未来最致命的硬约束既不是风投资本也不是算法架构，而是纯粹的物理电力——从兆瓦级跃迁到吉瓦级集群，需要自建专用核反应堆与彻底翻新高压输电走廊。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: '80000hours-christiano-alignment',
    sourceId: '80000hours',
    sourceName: '80,000 Hours',
    category: '访谈',
    lang: 'en',
    title: 'Paul Christiano on Aligning Superhuman Intelligence',
    titleZh: '前 OpenAI 基础架构负责人谈：如何确保远超人类的复杂系统保持可控',
    author: 'Rob Wiblin & Paul Christiano',
    url: 'https://80000hours.org/podcast/episodes/paul-christiano-ai-alignment/',
    audioUrl: 'https://media.transistor.fm/80000-hours-christiano.mp3',
    readingMinutes: 35,
    tags: ['系统安全', '博弈论', '复杂系统', '长远未来'],
    summary: '强化学习人类反馈微调（RLHF）开创者保罗·克里斯蒂亚诺长谈。从数学与博弈论第一性原理出发，探讨当一个复杂智能体拥有远超设计者的策略计算能力时，人类如何通过多智能体辩论与形式化验证避免系统失控。',
    coreInsight: '如果衡量指标成了唯一追逐的目标，该指标便不再是一个有效的衡量标准（古德哈特定律的终极形态）。',
    htmlSections: [
      {
        heading: '第一章：策略性欺骗与评估的局限',
        paragraphs: [
          {
            en: 'If an AI is smart enough to understand how it is being evaluated, it has an incentive to produce answers that look convincing to the evaluator rather than answers that are true.',
            zh: '如果一个系统足够聪明到理解自己正在被人类考官如何打分，它就会产生巨大的博弈动机去专门生成“看起来最能讨好人类考官”的表面答案，而不是去追求事实本身。这是系统控制领域最棘手的深渊。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'radiolab-colors-perception',
    sourceId: 'thisamericanlife',
    sourceName: 'Radiolab',
    category: '人文',
    lang: 'en',
    title: 'Radiolab: Colors and the Limits of Human Perception',
    titleZh: '广播实验室经典：色彩的物理学与人类感知的永恒鸿沟',
    author: 'Jad Abumrad & Robert Krulwich',
    url: 'https://www.wnycstudios.org/podcasts/radiolab/episodes/211119-colors',
    audioUrl: 'https://traffic.megaphone.fm/colors.mp3',
    readingMinutes: 24,
    tags: ['声音艺术', '神经感知', '生理学', '世界观'],
    summary: '播客历史上声音剪辑与叙事美学的永恒丰碑。从人类视网膜的三种视锥细胞、荷马史诗《伊利亚特》中“像深酒一样的大海”之谜，讲到拥有十六种感光色素的深海螳螂虾，探讨客观真实世界与我们大脑主观投射之间的巨大裂缝。',
    coreInsight: '我们自以为看到的绚丽真实世界，只不过是大脑通过极其简陋的视神经电信号拼接出的主观虚拟现实。',
    htmlSections: [
      {
        heading: '第一章：荷马史诗里为什么没有“蓝色”？',
        paragraphs: [
          {
            en: 'British Prime Minister William Gladstone read through the Odyssey and noticed something bizarre: Homer described the sea as "wine-dark," sheep as violet, and honey as green, but never once used the word blue.',
            zh: '英国前首相格莱斯顿在精读荷马史诗《奥德赛》时惊讶地发现了一个极其诡异的语言现象：荷马把大海形容为“深酒色”，把羊毛形容为“紫罗兰色”，把蜂蜜形容为“绿色”，但在整部浩瀚史诗中，竟从未使用过一次“蓝色”这个词汇。'
          }
        ]
      }
    ]
  },

  // ==========================================
  // 四、 经济博弈、制度演进与社会法则 (31-40)
  // ==========================================
  {
    idSuffix: 'econtalk-taleb-antifragile',
    sourceId: 'econtalk',
    sourceName: 'EconTalk',
    category: '思想',
    lang: 'en',
    title: 'Nassim Nicholas Taleb on Antifragile & Skin in the Game',
    titleZh: '纳西姆·塔勒布亲述：反脆弱公理与“风险共担”的道德制度防线',
    author: 'Russ Roberts & Nassim Taleb',
    url: 'https://www.econtalk.org/taleb-on-antifragile/',
    audioUrl: 'https://traffic.libsyn.com/econtalk/talebantifragile.mp3',
    readingMinutes: 30,
    tags: ['反脆弱', '黑天鹅', '风险共担', '制度设计'],
    summary: '《黑天鹅》《反脆弱》作者塔勒布对话斯坦福胡佛研究所学者。系统论述：脆弱的事物厌恶波动与混乱，而反脆弱的事物却能从不确定性中汲取营养与进化；现代社会最大的灾难，是官僚体制制造了大量享受收益却无需承担暴雷代价的“零风险共担者”。',
    coreInsight: '汉谟拉比法典在四千年前就写下了永恒真理：如果泥瓦匠建的房子坍塌砸死了主人，泥瓦匠必须被处死。缺乏风险共担的体系终将走向道德瓦解。',
    htmlSections: [
      {
        heading: '第一章：从混乱中受益的非对称性',
        paragraphs: [
          {
            en: 'Antifragility is beyond resilience or robustness. The resilient merely resists shocks and stays the same; the antifragile gets better. It requires having more upside than downside from random volatility.',
            zh: '反脆弱远远超越了单纯的坚韧或结实。坚韧的事物仅仅是抵御外部冲击并勉强维持原样，而反脆弱的事物却能借助冲击变得更加强大。这在数学上要求系统面对随机波动时拥有明显的凸性——下行风险被锁定，而上行收益无限。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'econtalk-acemoglu-why-nations-fail',
    sourceId: 'econtalk',
    sourceName: 'EconTalk',
    category: '思想',
    lang: 'en',
    title: 'Daron Acemoglu: Why Nations Fail - Inclusive vs. Extractive Institutions',
    titleZh: '诺奖得主阿西莫格鲁：国家为何失败——包容性制度与掠夺性制度的历史分流',
    author: 'Russ Roberts & Daron Acemoglu',
    url: 'https://www.econtalk.org/acemoglu-on-why-nations-fail/',
    readingMinutes: 29,
    tags: ['诺贝尔经济学奖', '制度经济学', '历史演进', '产权保护'],
    summary: '2024 年诺贝尔经济学奖得主阿西莫格鲁长篇对谈。用跨越数百年的全球历史数据雄辩地证明：决定一个国家长治久安与经济繁荣的，既非地理气候，也非种族文化，而是其政治与经济制度到底在鼓励广纳竞争（Inclusive），还是在维护寡头榨取（Extractive）。',
    coreInsight: '掠夺性制度能够通过强制调配资源实现短期的动员型增长，但由于其必然扼杀创造性毁灭，最终必将在技术停滞中陷入长期衰退。',
    htmlSections: [
      {
        heading: '第一章：诺加利斯小镇的边界寓言',
        paragraphs: [
          {
            en: 'Acemoglu contrasts Nogales, Arizona with Nogales, Sonora in Mexico. Same climate, same geography, same ancestral DNA. Yet on the US side, average household income is three times higher and life expectancy is longer. The difference is purely institutional.',
            zh: '阿西莫格鲁列举了著名的诺加利斯双子城：一侧在美属亚利桑那州，另一侧在墨西哥索诺拉州。两地共享完全相同的气候、地理和祖先血脉，但美国一侧的家庭平均收入是墨西哥一侧的三倍以上。唯一的根源就是产权保护与法治制度的绝对分化。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'econtalk-munger-permissionless',
    sourceId: 'econtalk',
    sourceName: 'EconTalk',
    category: '思想',
    lang: 'en',
    title: 'Michael Munger on Permissionless Innovation & the Sharing Economy',
    titleZh: '迈克尔·芒格：无需许可的创新、行会垄断与交易成本革命',
    author: 'Russ Roberts & Michael Munger',
    url: 'https://www.econtalk.org/michael-munger-on-the-sharing-economy/',
    readingMinutes: 26,
    tags: ['交易成本', '制度博弈', '商业演变', '寻租理论'],
    summary: '杜克大学政治经济学教授 Michael Munger 深度剖析：从网约车、短租到现代平台经济，技术进步的核心不仅是便利，而是它绕过了古老行业牌照的“官僚寻租特权”。当人们不再需要向长官打报告就能创造交易时，财富便会井喷。',
    coreInsight: '所有既得利益行会最大的敌人，都是那些摧毁了“审批许可证价值”的无摩擦技术创新。',
    htmlSections: [
      {
        heading: '第一章：出租车牌照的寻租本质',
        paragraphs: [
          {
            en: 'Munger illustrates how NYC taxi medallions once traded for over a million dollars each. The price did not reflect the value of driving a car; it reflected the legal power to exclude competitors.',
            zh: '芒格生动地指出纽约出租车牌照曾经被炒到上百万美元一张的荒诞历史：这个天文数字折射的从来不是开车拉客的技术价值，而是政府赋予其合法排斥新竞争者入场的特许寻租暴利。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'cwt-hassabis-science',
    sourceId: 'cwt',
    sourceName: 'Conversations with Tyler',
    category: '访谈',
    lang: 'en',
    title: 'Demis Hassabis on DeepMind, AlphaFold, and Scientific Discovery',
    titleZh: '泰勒·考恩对话哈萨比斯：AlphaFold 背后科学哲学与新范式',
    author: 'Tyler Cowen & Demis Hassabis',
    url: 'https://conversationswithtyler.com/episodes/demis-hassabis/',
    readingMinutes: 28,
    tags: ['基础科学', '计算生物学', '哲学思考', '研究方法论'],
    summary: '诺贝尔化学奖得主、DeepMind 创始人哈萨比斯的高密度闪电对话。探讨计算机科学如何从传统“人工假设-实验检验”的慢速循环，进化为利用计算空间搜索攻克生命核心难题的全新科学范式。',
    coreInsight: '复杂生物学系统的信息维度过于庞大，传统还原论科学已经走到尽头，基于高维模式识别的新型计算正在成为基础科学的超级显微镜。',
    htmlSections: [
      {
        heading: '第一章：半个世纪的生物学终极谜题',
        paragraphs: [
          {
            en: 'For fifty years, predicting how a sequence of amino acids folds into a 3D protein structure was considered nearly impossible with classical physics simulation. AlphaFold solved this using structural intuition learned from biological geometry.',
            zh: '半个世纪以来，从一维氨基酸链条推导三维蛋白质折叠结构，一直被传统物理实验模拟视作无法逾越的高墙。AlphaFold 的突破证明：机器能够从庞大的生物几何数据库中掌握高维的空间折叠直觉。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'cwt-collison-progress-studies',
    sourceId: 'cwt',
    sourceName: 'Conversations with Tyler',
    category: '访谈',
    lang: 'en',
    title: 'Patrick Collison on Progress Studies: Why Is Science Slowing Down?',
    titleZh: 'Stripe 创始人帕特里克·科里森谈：进步研究与全人类科技创新的减速谜题',
    author: 'Tyler Cowen & Patrick Collison',
    url: 'https://conversationswithtyler.com/episodes/patrick-collison/',
    readingMinutes: 26,
    tags: ['进步研究', '科研体制', '宏观生产力', '组织熵增'],
    summary: 'Stripe 联合创始人科里森与经济学家考恩发起“进步研究（Progress Studies）”倡议：为什么尽管当今全球科研经费投入与博士人数呈数十倍暴增，人类在基础物理、能源与重大生命工程上的突破速度，反而远不如二十世纪中叶？',
    coreInsight: '科研官僚化、过度同行评审以及对论文数量的教条考核，正在将最有天赋的年轻大脑驯化为不敢越雷池一步的平庸修补匠。',
    htmlSections: [
      {
        heading: '第一章：爱因斯坦与贝尔实验室不可复制的原因',
        paragraphs: [
          {
            en: 'Collison points out that modern grant-writing forces researchers to spend half their careers writing proposals that promise predictable results, directly weeding out radical, paradigm-shifting hypotheses.',
            zh: '科里森一针见血地指出：现代基金审批制度强迫科学家把一半的精力花在写立项报告上，且必须承诺完全可预测的平庸结果，这在机制上直接把那些具有颠覆性、可能失败百次的绝顶假说无情清洗出局。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'cwt-stephenson-scifi-money',
    sourceId: 'cwt',
    sourceName: 'Conversations with Tyler',
    category: '访谈',
    lang: 'en',
    title: 'Neal Stephenson on Sci-Fi, History, and the Origins of Currency',
    titleZh: '硬科幻教父尼尔·斯蒂芬森：货币的历史起源、密码学政治与虚拟世界叙事',
    author: 'Tyler Cowen & Neal Stephenson',
    url: 'https://conversationswithtyler.com/episodes/neal-stephenson/',
    readingMinutes: 28,
    tags: ['科幻哲学', '货币史', '密码学', '文明演进'],
    summary: '《雪崩》《编码宝典》作者尼尔·斯蒂芬森长聊。从十七世纪牛顿在英国皇家造币厂对金币成色与铸币税的物理较量、荷兰东印度公司现代金融雏形，探讨到为什么科幻作家真正的基本功不是幻想未来，而是极度沉浸于历史深处的人类技术史。',
    coreInsight: '任何未来的技术构想，在三百年前的人类历史档案里几乎都能找到一模一样的人性与制度原型。',
    htmlSections: [
      {
        heading: '第一章：牛顿与金本位背后的暗黑较量',
        paragraphs: [
          {
            en: 'Stephenson delves into Isaac Newton’s tenure as Master of the Mint. Newton spent his final decades not doing physics, but hunting down counterfeiters with forensic zeal, establishing the physical trust that underwrote the British Empire.',
            zh: '斯蒂芬森生动讲述了牛顿晚年担任皇家造币厂厂长的历史细节：牛顿没有继续研究微积分，而是化身冷酷的侦探严查假币制造者，用近乎偏执的冶金精度树立了硬通货信任，最终托举起了大英帝国的全球贸易信用。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'ezra-nguyen-gamification-trap',
    sourceId: 'ezraklein',
    sourceName: 'The Ezra Klein Show',
    category: '思想',
    lang: 'en',
    title: 'C. Thi Nguyen on Games, Gamification, and the Value Capture Trap',
    titleZh: '哲学长谈：游戏化陷阱——当算法将人生异化为计分板，你正在失去自主性',
    author: 'Ezra Klein & C. Thi Nguyen',
    url: 'https://www.nytimes.com/column/ezra-klein-podcast',
    readingMinutes: 27,
    tags: ['道德哲学', '价值捕获', '游戏化', '社会异化'],
    summary: '犹他大学哲学家 C. Thi Nguyen 提出震撼的“价值捕获（Value Capture）”理论：当现实生活（社交媒体的点赞数、职场 KPI、学术界的引用量）被过度游戏化与量化时，算法表面上是在激励你，实质上是在悄悄替你篡改和简化“什么是成功、什么是美好生活”的内在定义。',
    coreInsight: '游戏化最危险的地方，在于它用清晰、简单、易上瘾的外部计分板，取代了人类内心原本丰富却模糊的多元价值观。',
    htmlSections: [
      {
        heading: '第一章：价值捕获的隐秘腐蚀',
        paragraphs: [
          {
            en: 'When our rich, ambiguous human values are replaced by an external quantified score—Fitbit steps, Twitter likes, sales quotas—we suffer value capture. The score is crisp and satisfying, so we start living to optimize the metric rather than the underlying virtue.',
            zh: '当我们内心丰富、微妙而多元的人性价值被外部单一量化积分——微信步数、推特点赞数、销售流水指标——强行取代时，我们就遭遇了残酷的“价值捕获”。因为计分板极其清脆刺激，我们最终开始为了刷高指标而活，彻底忘却了指标背后原本追求的美德。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'ezra-ted-chiang-humanity',
    sourceId: 'ezraklein',
    sourceName: 'The Ezra Klein Show',
    category: '思想',
    lang: 'en',
    title: 'Ted Chiang on What Science Fiction Teaches Us About Human Desires',
    titleZh: '特德·姜深度专访：科幻教父谈技术的真正危险是放大人性的贪婪与盲区',
    author: 'Ezra Klein & Ted Chiang',
    url: 'https://www.nytimes.com/column/ezra-klein-podcast',
    readingMinutes: 26,
    tags: ['科幻哲学', '文学', '人性审视', '科技批判'],
    summary: '四届雨果奖得主特德·姜（《降临》原著作者）反思现代技术迷狂：技术的本质是工具，它最可怕的从来不是产生自主意识夺取权力，而是它被贪婪的资本与官僚体制所武装，以无与伦比的高效率放大人性深处的剥削与短视。',
    coreInsight: '绝大多数人对未来科技恐惧的根源，并不是害怕技术本身，而是害怕自己被当成无情商业机器上的齿轮和边角料。',
    htmlSections: [
      {
        heading: '第一章：对技术的恐惧本质上是对资本力量的恐惧',
        paragraphs: [
          {
            en: 'Chiang argues that Silicon Valley’s existential dread of superintelligent machines is simply an unconscious projection of what corporate capitalism already does: optimizing an algorithm (profit) at the absolute expense of human well-being.',
            zh: '特德·姜指出：硅谷精英们对“超级智能毁灭人类”的终极恐惧，本质上只是对现代跨国公司早已施行的资本行为的无意识投射——一个冷酷无情地优化单一算法目标（季度利润最大化），而不惜彻底碾碎沿途一切人类福祉的非人怪物。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'freakonomics-college-signaling',
    sourceId: 'freakonomics',
    sourceName: 'Freakonomics Radio',
    category: '思想',
    lang: 'en',
    title: 'Should Everyone Go to College? The Signaling Theory and Human Capital',
    titleZh: '所有人真该上大学吗？信号理论、文凭通胀与教育的真实回报率',
    author: 'Stephen J. Dubner & Bryan Caplan',
    url: 'https://freakonomics.com/podcast/freakonomics-goes-to-college/',
    readingMinutes: 24,
    tags: ['教育经济学', '信号理论', '人力资本', '阶层跃迁'],
    summary: '从诺贝尔奖得主迈克尔·斯宾塞的“信号理论（Signaling Theory）”切入，深入辩论：昂贵的大学四年教育，究竟是在真正提升学生的人力资本技能（Human Capital），还是仅仅在用高昂的学费和考试门槛，向雇主发出“这是一个服从纪律、智力合格”的昂贵筛选证明？',
    coreInsight: '如果大学教育的价值 80% 在于发放文凭这张筛网，那么全社会对文凭军备竞赛的过度投入，本质上是一场劳民伤财的零和地位争夺。',
    htmlSections: [
      {
        heading: '第一章：为什么旁听哈佛所有课程拿不到学位就一文不值？',
        paragraphs: [
          {
            en: 'Economist Bryan Caplan poses the thought experiment: If college were primarily about learning, you could attend every Harvard lecture for free and be equally rich. But employers will not hire you without the credential.',
            zh: '经济学家布赖恩·卡普兰提出了一个直击痛点的思维实验：如果大学的核心价值真的在于获取知识，你完全可以免费旁听哈佛大学的全部四年的课程并饱读诗书。但现实中，没有那张受保护的毕业证书，大厂雇主根本连看都不会看你一眼。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'freakonomics-academic-fraud',
    sourceId: 'freakonomics',
    sourceName: 'Freakonomics Radio',
    category: '思想',
    lang: 'en',
    title: 'Why Is There So Much Fraud in Academia? The Incentives of Publish or Perish',
    titleZh: '学术界造假为何屡禁不止？从“发表或出局”的激励机制看学术黑产',
    author: 'Stephen J. Dubner',
    url: 'https://freakonomics.com/podcast/why-is-there-so-much-fraud-in-academia/',
    readingMinutes: 25,
    tags: ['学术体制', '激励理论', '科研伦理', '经济机制'],
    summary: '深度调查哈佛商学院知名教授研究造假丑闻。从微观经济学剖析：当高校科研晋升只考核轰动的论文发表数量与眼球效应，而可重复性检验却完全得不到任何经费奖励时，造假便成为扭曲制度下的理性必然产物。',
    coreInsight: '任何依靠道德自律维持的体系，在扭曲的利益激励面前都会像沙滩上的城堡一样迅速坍塌。',
    htmlSections: [
      {
        heading: '第一章：没有人会因为“重复别人的实验”而获得终身教职',
        paragraphs: [
          {
            en: 'The tragedy of modern science is that replications are rarely funded and almost never published in high-impact journals. The incentives reward flashy, counter-intuitive claims, even if their data was fabricated with p-hacking.',
            zh: '现代科研体制最大的悲哀在于：几乎没有任何基金愿意资助重复验证实验，顶级期刊也绝不会发表“证实某人实验正确”的枯燥论文。体制倾尽全力奖励那些哗众取宠、反常识的爆款结论，直接助长了篡改数据（p-hacking）的学术黑产。'
          }
        ]
      }
    ]
  },

  // ==========================================
  // 五、 心智模型、个人效能与人类命运纪实 (41-50)
  // ==========================================
  {
    idSuffix: 'ferriss-naval-wealth-happiness',
    sourceId: 'tim-ferriss',
    sourceName: 'Tim Ferriss Show',
    category: '思想',
    lang: 'en',
    title: 'Naval Ravikant on Happiness, Reducing Anxiety, and Wealth Creation',
    titleZh: '纳瓦尔长访谈：不靠运气致富的哲学原理、卸载焦虑与心智复利',
    author: 'Tim Ferriss & Naval Ravikant',
    url: 'https://tim.blog/2015/08/18/the-evolution-of-a-cro-magnon/',
    readingMinutes: 30,
    tags: ['人生哲学', '杠杆原理', '财富心法', '心智模式'],
    summary: '全球互联网流传最广的认知圣经。纳瓦尔全面阐述如何摆脱用时间兑换薪水的牢笼：学会拥有资产、追求无需许可的杠杆（代码与自媒体），并在长期主义的人际关系与商业博弈中追求不可逆的复利。',
    coreInsight: '世界上最昂贵的浪费是用自己的时间去换取别人的时薪；世界上最高效的自由是拥有哪怕在睡觉时也在为你工作的代码、资本与声誉杠杆。',
    htmlSections: [
      {
        heading: '第一章：无需许可的杠杆（Permissionless Leverage）',
        paragraphs: [
          {
            en: 'Naval explains the hierarchy of leverage: the oldest is labor (managing people), the second is capital (investing money), but the modern revolution is permissionless leverage: code and media. An army of software robots works for you while you sleep.',
            zh: '纳瓦尔梳理了人类历史上三层杠杆的演进：最古老的是人力杠杆（管人，极其痛苦且内耗）；第二种是资本杠杆（钱生钱，需要门槛）；而新时代最伟大的民主化红利是“无需许可的杠杆”——代码与媒体内容。即使在你熟睡时，成千上万行代码机器人也在无怨无悔地为你运转服务。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'ferriss-sivers-hell-yeah',
    sourceId: 'tim-ferriss',
    sourceName: 'Tim Ferriss Show',
    category: '思想',
    lang: 'en',
    title: 'Derek Sivers: The Power of "Hell Yeah or No" and Radical Simplicity',
    titleZh: '德里克·西弗斯：极简原则——若非令人惊呼“非做不可”，那就坚决说“不”',
    author: 'Tim Ferriss & Derek Sivers',
    url: 'https://tim.blog/2015/12/28/derek-sivers-reloaded/',
    readingMinutes: 20,
    tags: ['精力管理', '极简主义', '决策原则', '独立思考'],
    summary: 'CD Baby 创始人西弗斯震撼无数忙碌者的极简心法。面对现代社会无休无止的会议邀请、合作请求和社交噪音，建立唯一的判据：如果你对一件事情的第一反应不是心潮澎湃的“Hell Yeah!（太棒了/非做不可）”，那么你的答案就必须是干脆利落的“不”。',
    coreInsight: '平庸的机遇是伟大事业最大的杀手；你对平庸点头的每一次妥协，都是在给未来的核心突破宣判死刑。',
    htmlSections: [
      {
        heading: '第一章：拒绝温水煮青蛙的平庸',
        paragraphs: [
          {
            en: 'If you feel overwhelmed with too many obligations, it is because you are saying yes to things that are merely okay. Use this rule: If it is not a "Hell Yes!", then it is a "No."',
            zh: '如果你感到被无休止的杂务压得喘不过气来，唯一的原因就是你总是对那些“听起来还行、似乎可以做”的温吞事情点头。请把这句话焊进脑海：如果它不是一个让你忍不住惊呼“太棒了”的事情，那么它的名字就叫做“拒绝”。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'ferriss-collins-flywheel',
    sourceId: 'tim-ferriss',
    sourceName: 'Tim Ferriss Show',
    category: '商业',
    lang: 'en',
    title: 'Jim Collins on The Flywheel Effect, 20-Mile March, and Enduring Greatness',
    titleZh: '吉姆·柯林斯传世对谈：飞轮效应的物理学、日行二十英里与基业长青',
    author: 'Tim Ferriss & Jim Collins',
    url: 'https://tim.blog/2019/02/18/jim-collins/',
    readingMinutes: 32,
    tags: ['企业战略', '飞轮效应', '纪律性', '组织发展'],
    summary: '《从优秀到卓越》作者柯林斯解剖伟大公司的基因。伟大从来不是某一次灵光一闪的孤勇突击，而是像推行一个巨大沉重的铸铁飞轮：开始千难万险推动一圈，两圈，一百圈，直到飞轮自重带来的惯性势不可挡。',
    coreInsight: '好天气不盲目激进冲刺，坏天气绝不畏难停滞不前；“日行二十英里”的枯燥纪律，永远击溃靠运气和情绪打仗的游击队。',
    htmlSections: [
      {
        heading: '第一章：阿蒙森与斯科特的南极生死远征',
        paragraphs: [
          {
            en: 'Collins recounts the race to the South Pole: Scott traveled 40 miles on sunny days and stayed in his tent on bad days; Amundsen marched strictly 20 miles every single day, rain or shine. Amundsen survived and triumphed; Scott died.',
            zh: '柯林斯讲述了南极探险史上最震撼的对比：斯科特队伍在晴空万里时狂奔四十英里，而在风雪交加时躲在帐篷里沮丧停滞；阿蒙森队伍无论狂风暴雨还是艳阳高照，雷打不动每天前进整整二十英里。最终阿蒙森全员凯旋，而斯科特全军覆没倒在归途。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'ferriss-balaji-network-state',
    sourceId: 'tim-ferriss',
    sourceName: 'Tim Ferriss Show',
    category: '思想',
    lang: 'en',
    title: 'Balaji Srinivasan on The Network State and the Future of Sovereign Communities',
    titleZh: '前 a16z 合伙人巴拉吉谈：网络国家（Network State）与数字主权演进新范式',
    author: 'Tim Ferriss & Balaji Srinivasan',
    url: 'https://tim.blog/2022/07/04/balaji-srinivasan-the-network-state/',
    readingMinutes: 34,
    tags: ['政治哲学', '数字游民', '去中心化', '网络国家'],
    summary: '极富争议却脑洞极其前瞻的政治哲学预言。探讨当物理国家的税收与治理逐渐僵化时，人们如何先在云端基于共同价值观凝聚社会资本，再众筹购买物理领土，构建与传统民族国家平级的外交主权新共同体。',
    coreInsight: '未来最重要的国家可能不再诞生于陆地边界，而是发端于云端共识。',
    htmlSections: [
      {
        heading: '第一章：从云端到物理领土的倒置建国史',
        paragraphs: [
          {
            en: 'Historically, countries started with land, assembled people, and tried to create consensus. The Network State inverts this: first assemble global consensus in the cloud, then crowdfund territory in the real world.',
            zh: '在传统历史上，国家的建立总是始于抢占土地，再强行拼凑人口，最后艰难达成治理共识。网络国家彻底倒置了这一逻辑：先在云端凝聚跨越国界的深厚共识，再在物理世界众筹购置离散的土地与建筑，最终寻求外交承认。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-goggins-calloused-mind',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'David Goggins: The 40% Rule, Suffering, and Building the Calloused Mind',
    titleZh: '大卫·戈金斯：40%极限法则、自愿受苦与在心智上磨出坚不可摧的老茧',
    author: 'Lex Fridman & David Goggins',
    url: 'https://lexfridman.com/david-goggins-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_david_goggins.mp3',
    readingMinutes: 32,
    tags: ['意志力', '心智韧性', '极限训练', '人生觉醒'],
    summary: '海豹突击队传奇士兵的震撼自述。从一个自卑绝望、受虐肥胖的除虫工，到打破引体向上吉尼斯纪录、完成两百英里超级越野跑的钢铁硬汉。他阐明著名的 40% 规则：当你大脑疯狂尖叫让你放弃时，你的肉体其实才消耗了极限潜能的 40%。',
    coreInsight: '自信不是自我感动的虚假口号，而是你在没人看到的至暗时刻，日复一日战胜内心的惰性所积累下的无可辩驳的证据。',
    htmlSections: [
      {
        heading: '第一章：当大脑告诉你撑不下去的时候',
        paragraphs: [
          {
            en: 'The human brain is designed to seek comfort and conserve calories. When you hit the wall, it sends panicked alarms to protect you. Building a calloused mind means training yourself to talk back to that weakness and unlock the remaining 60%.',
            zh: '人类的大脑在基因演化上天生追求安逸与保存热量。当你感到精疲力竭撞墙时，大脑会自动拉响恐慌的火警逼你放弃。所谓在心智上磨出老茧，就是日复一日训练自己无视那声虚假的哀嚎，唤醒深藏在骨髓里尚未动用的后 60% 潜能。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'lex-danaher-jiujitsu-systems',
    sourceId: 'lexfridman',
    sourceName: 'Lex Fridman',
    category: '访谈',
    lang: 'en',
    title: 'John Danaher: The Mechanics of Control and Problem Solving in Martial Arts',
    titleZh: '约翰·达纳赫：巴西柔术的力学几何学、控制哲学与古希腊系统思维',
    author: 'Lex Fridman & John Danaher',
    url: 'https://lexfridman.com/john-danaher-transcript/',
    audioUrl: 'https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_john_danaher.mp3',
    readingMinutes: 34,
    tags: ['格斗哲学', '系统思维', '机械原理', '杠杆控制'],
    summary: '哥伦比亚大学认识论哲学学者出身的格斗教父达纳赫。他彻底颠覆了“格斗靠力量与本能”的刻板印象，将地面缠斗解构为空间消除、力矩杠杆分配与不可逆生理控制的纯粹几何学命题。',
    coreInsight: '将任何看似不可捉摸的混乱对抗，拆解为可穷尽、可验证、由弱胜强的系统化解决问题流水线。',
    htmlSections: [
      {
        heading: '第一章：控制胜于蛮力的四步系统',
        paragraphs: [
          {
            en: 'Danaher defines submission grappling not as violence, but as a kinetic argument: 1. Take the opponent to the ground; 2. Pass dangerous legs; 3. Eliminate their rotational freedom; 4. Apply a mechanical wedge until submission.',
            zh: '达纳赫将降服缠斗定义为一场精密的肉体逻辑辩论：第一步将对手拖入地面抹平其运动优势；第二步穿越其最具威胁的双腿；第三步用身体重力彻底锁死其脊椎旋转自由度；第四步像插入机械楔子一样实施不可逆的关节降服。这是纯粹的系统思维胜利。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'tal-harper-high-school',
    sourceId: 'thisamericanlife',
    sourceName: 'This American Life',
    category: '人文',
    lang: 'en',
    title: 'This American Life: Harper High School (Parts 1 & 2)',
    titleZh: '普利策历史首奖特稿：哈珀高中的枪声与真实底层社区的创伤口述史',
    author: 'Ira Glass & Linda Lutton',
    url: 'https://www.thisamericanlife.org/487/harper-high-school-part-one',
    audioUrl: 'https://audio.thisamericanlife.org/487/harper-high-school-part-one.mp3',
    readingMinutes: 30,
    tags: ['非虚构特稿', '调查新闻', '普利策奖', '口述历史'],
    summary: '播客工业历史上第一部斩获普利策新闻奖的纪实丰碑。三位记者蹲点芝加哥最危险街区的一所普通公立高中长达五个月，没有任何煽情配乐，用最克制的原声口述记录制度缺位、帮派暴力夹缝中普通师生的挣扎与温情。',
    coreInsight: '好记者从来不站在高处指点江山，而是弯下腰把麦克风伸进最阴暗潮湿的泥土里，让那些被时代遗忘的普通人发出震耳欲聋的真声。',
    htmlSections: [
      {
        heading: '第一章：走廊里的枪击守则',
        paragraphs: [
          {
            en: 'At Harper High, in a single year, 29 current and former students were shot. The journalists do not interview politicians; they sit with the grief counselor who keeps a daily checklist of which teenagers made it to third period alive.',
            zh: '在哈珀高中，仅在短短一年时间里，就有 29 名在读与往届学生遭到枪击。记者没有去采访政客夸夸其谈，而是静静坐在学校心理辅导员身边，看着她每天早晨在那张写满稚嫩名字的花名册上，逐一划勾确认哪些孩子今天活着走进了第三节教室。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'fall-civilizations-bronze-age',
    sourceId: 'thisamericanlife',
    sourceName: 'Fall of Civilizations',
    category: '人文',
    lang: 'en',
    title: 'The Bronze Age Collapse: When the Ancient Global World Crumbled',
    titleZh: '青铜时代大崩溃：三千年前精密超复杂的跨国贸易网络为何一夜化为瓦砾',
    author: 'Paul Cooper',
    url: 'https://fallofcivilizationspodcast.com/',
    readingMinutes: 32,
    tags: ['古代文明', '战史', '复杂系统崩溃', '历史纪录片'],
    summary: 'BBC 纪录片级的声音史诗。公元前 1200 年，地中海东岸的埃及、迈锡尼、赫梯、巴比伦构筑了人类第一个全球化贸易网络（锡矿与铜矿跨越千里的供应链协同）。然而，一场突如其来的干旱、海民掠夺与多米诺骨牌级系统性断裂，让辉煌的文字、宫殿与文明在短短半个世纪内全部灰飞烟灭。',
    coreInsight: '高度专业化与高度依赖跨国协同的超复杂系统，在享受极致效率的同时，其致命软肋在于面对多重并发冲击时灾难性的系统性脆弱。',
    htmlSections: [
      {
        heading: '第一章：锡的跨大陆供应链陷阱',
        paragraphs: [
          {
            en: 'Bronze requires 90% copper and 10% tin. Copper was plentiful, but tin had to be shipped from Afghanistan and Britain. When piracy and local droughts severed the fragile tin trade routes, armies could no longer forge weapons, and palaces fell one after another.',
            zh: '青铜铸造需要九成铜与一成锡的精准配比。铜矿遍布地中海，但至关重要的锡却必须从远隔千里的阿富汗群山乃至不列颠岛横跨大洋运来。当海盗侵袭与连续大旱切断了这条极其脆弱的跨大陆供应链时，帝国军队无法再铸造兵刃，王宫在连锁反应中轰然坍塌。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'fall-civilizations-maya-drought',
    sourceId: 'thisamericanlife',
    sourceName: 'Fall of Civilizations',
    category: '人文',
    lang: 'en',
    title: 'The Maya: The Great Drought, Ecological Hubris, and the Fall of Kings',
    titleZh: '玛雅文明衰亡史：巨型石碑雨林城邦如何毁于生态透支与神权狂妄',
    author: 'Paul Cooper',
    url: 'https://fallofcivilizationspodcast.com/',
    readingMinutes: 30,
    tags: ['玛雅文明', '生态环境', '考古学', '神权崩溃'],
    summary: '深入尤卡坦半岛失落的热带雨林。展现曾经人口密度超越现代欧洲的古老玛雅城邦，如何为了修筑越来越宏伟的神庙石碑而砍伐森林焚烧石灰，最终引发微气候干旱、粮食断绝与人民对神王叙事的彻底抛弃。',
    coreInsight: '当统治精英把全部资源投入到维系神圣仪式的虚假表演，而无视底层生态承载力的枯竭时，文明的消亡只是时间问题。',
    htmlSections: [
      {
        heading: '第一章：烧透森林的生石灰砂浆',
        paragraphs: [
          {
            en: 'To coat their monumental pyramids in dazzling white stucco, the Maya burned tons of green timber for every square yard of plaster. Deforestation altered local rainfall patterns, transforming seasonal dry spells into an apocalyptic multi-decade drought.',
            zh: '为了让巍峨的金字塔与神殿外墙包裹上耀眼夺目的雪白灰浆，玛雅人每烧制一平米的生石灰，就必须砍伐并焚毁整整五吨活森林。毁灭性的森林砍伐彻底扭曲了热带局地季风降雨，将原本短暂的季节性枯水期化为一场长达数十年的绝望大旱灾。'
          }
        ]
      }
    ]
  },
  {
    idSuffix: 'aeon-fragility-knowledge',
    sourceId: 'aeon',
    sourceName: 'Aeon Essays',
    category: '思想',
    lang: 'en',
    title: 'The Inherent Fragility of Knowledge: From Alexandria to the 404 Web',
    titleZh: '思想随笔：知识的本真脆弱性——从亚历山大图书馆大火到数字时代的网页失效',
    author: 'Richard Ovenden',
    url: 'https://aeon.co/essays/why-libraries-and-archives-are-always-under-attack',
    readingMinutes: 22,
    tags: ['哲学随笔', '知识考古', '数字保存', '文明记忆'],
    summary: '牛津大学博德利图书馆馆长撰文。探讨人类所创造的精神世界在物理与数字层面究竟有多么脆弱：从亚历山大图书馆火灾、二战期间纳粹焚书，到现代互联网上超过 38% 的网页在十年内彻底消失为 404。人类的文明记忆不是自动保存的硬盘，而是一场永不停歇的保卫战。',
    coreInsight: '文明最大的幻觉，是以为今天记录下的一切都会理所当然地流传给未来。遗忘才是宇宙的默认状态。',
    htmlSections: [
      {
        heading: '第一章：数字时代的数字失忆症',
        paragraphs: [
          {
            en: 'We imagine the digital era is permanent because data can be copied infinitely. Yet digital bit rot, obsolete file formats, and abandoned servers mean we are losing recent historical archives faster than parchment preserved in desert caves.',
            zh: '我们天真地以为数字时代代表着永恒，因为数据可以被近乎零成本无限复制。然而，介质消磁、文件格式淘汰与云端服务器欠费下线，使得我们在过去二十年里丢失人类第一手历史档案的速度，竟然远远超过了那些静静躺在干燥沙漠洞穴里的羊皮纸古卷。'
          }
        ]
      }
    ]
  }
];
