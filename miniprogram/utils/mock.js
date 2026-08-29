// utils/mock.js —— 演示数据（真实环境由后端 /api/v1/providers/online 等返回）
// 角色：统一为倾听者；认证等级 level 1=实习 2=认证 3=资深

const tags = [
  '焦虑', '抑郁', '失眠', '职场压力', '亲密关系', '原生家庭',
  '学业', '自我成长', '情绪管理', '孤独', '社交恐惧', '迷茫'
]

const providers = [
  {
    id: 1001, role: 2, nickName: '林清和', avatarColor: '#4FB8A8',
    level: 3, levelText: '资深倾听者', rating: 4.9, total_sessions: 1260,
    price_per_minute: 2.0, is_online: true,
    intro: '国家二级心理咨询师，8年临床陪伴经验。擅长用温暖而专业的方式，陪你梳理情绪、看见关系里的自己。',
    expertise: ['焦虑', '亲密关系', '自我成长', '原生家庭'],
    years_of_exp: 8, background: '北师大临床心理学硕士，受训于中德班CBT连续项目。',
    certificate_no: '18230000xxxx'
  },
  {
    id: 1002, role: 1, nickName: '小满', avatarColor: '#FF9E80',
    level: 2, levelText: '认证倾听者', rating: 4.8, total_sessions: 540,
    price_per_minute: 1.0, is_online: true,
    intro: '在这里你可以什么都不说，也可以说很多。我愿意做那个安静接住你的人。',
    expertise: ['孤独', '情绪管理', '失眠', '迷茫']
  },
  {
    id: 1003, role: 1, nickName: '阿树', avatarColor: '#B5A8E0',
    level: 2, levelText: '认证倾听者', rating: 4.7, total_sessions: 312,
    price_per_minute: 1.0, is_online: true,
    intro: '程序员转行的倾听者，懂熬夜、懂内耗、懂说不出口的累。慢慢来，不急。',
    expertise: ['职场压力', '焦虑', '社交恐惧']
  },
  {
    id: 1004, role: 2, nickName: '苏晚', avatarColor: '#7AA0FF',
    level: 3, levelText: '资深倾听者', rating: 5.0, total_sessions: 2080,
    price_per_minute: 2.0, is_online: false,
    intro: '专注青年情绪与关系议题，用抱持性的空间陪你长出自己的力量。',
    expertise: ['抑郁', '亲密关系', '原生家庭', '自我成长'],
    years_of_exp: 11, background: '中科院心理所博士，EFT情绪聚焦取向。',
    certificate_no: '11230000xxxx'
  },
  {
    id: 1005, role: 1, nickName: '糖豆', avatarColor: '#FFC36B',
    level: 1, levelText: '实习倾听者', rating: 4.6, total_sessions: 86,
    price_per_minute: 1.0, is_online: true,
    intro: '还在学习，但足够真诚。愿意陪你聊聊那些白天说不出的话。',
    expertise: ['学业', '孤独', '迷茫']
  },
  {
    id: 1006, role: 1, nickName: '老周', avatarColor: '#6FCF97',
    level: 2, levelText: '认证倾听者', rating: 4.8, total_sessions: 720,
    price_per_minute: 1.0, is_online: false,
    intro: '中年大叔一枚，听过的故事比喝过的茶还多。生活的事，咱慢慢唠。',
    expertise: ['职场压力', '亲密关系', '情绪管理']
  }
]

// 当前用户的通话记录（演示）
const callRecords = [
  { id: 9001, providerName: '小满', callType: 1, durationText: '12分30秒', amount: 13.0, time: '08-26 21:14', rating: 5 },
  { id: 9002, providerName: '林清和', callType: 2, durationText: '08分05秒', amount: 18.0, time: '08-24 20:02', rating: 5 },
  { id: 9003, providerName: '阿树', callType: 1, durationText: '21分10秒', amount: 22.0, time: '08-21 23:40', rating: 4 }
]

module.exports = { tags, providers, callRecords }
