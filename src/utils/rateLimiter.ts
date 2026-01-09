// 使用制限のためのユーティリティ

const STORAGE_KEY_PREFIX = 'quiet_atelier_usage';
const MAX_DAILY_GENERATIONS = 10;
const COOLDOWN_SECONDS = 5;

interface UsageData {
  date: string;
  count: number;
  lastGenerationTime: number;
}

// 今日の日付を取得（YYYY-MM-DD形式）
const getTodayString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// ストレージキーを生成
const getStorageKey = (type: 'generate' | 'edit'): string => {
  return `${STORAGE_KEY_PREFIX}_${type}`;
};

// ローカルストレージから使用状況を取得
const getUsageData = (type: 'generate' | 'edit' = 'generate'): UsageData => {
  try {
    const stored = localStorage.getItem(getStorageKey(type));
    if (!stored) {
      return {
        date: getTodayString(),
        count: 0,
        lastGenerationTime: 0,
      };
    }
    
    const data: UsageData = JSON.parse(stored);
    
    // 日付が変わっていたらリセット
    if (data.date !== getTodayString()) {
      return {
        date: getTodayString(),
        count: 0,
        lastGenerationTime: 0,
      };
    }
    
    return data;
  } catch {
    return {
      date: getTodayString(),
      count: 0,
      lastGenerationTime: 0,
    };
  }
};

// 使用状況を保存
const saveUsageData = (data: UsageData, type: 'generate' | 'edit' = 'generate'): void => {
  try {
    localStorage.setItem(getStorageKey(type), JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save usage data:', error);
  }
};

// 生成可能かチェック
export const canGenerate = (): { allowed: boolean; reason?: string; remaining?: number } => {
  const data = getUsageData();
  
  // 1日の上限チェック
  if (data.count >= MAX_DAILY_GENERATIONS) {
    return {
      allowed: false,
      reason: `本日の生成回数上限（${MAX_DAILY_GENERATIONS}回）に達しました。明日またお試しください。`,
      remaining: 0,
    };
  }
  
  // クールダウンチェック
  const now = Date.now();
  const timeSinceLastGeneration = (now - data.lastGenerationTime) / 1000;
  
  if (timeSinceLastGeneration < COOLDOWN_SECONDS) {
    const waitTime = Math.ceil(COOLDOWN_SECONDS - timeSinceLastGeneration);
    return {
      allowed: false,
      reason: `生成中です。あと${waitTime}秒お待ちください。`,
      remaining: MAX_DAILY_GENERATIONS - data.count,
    };
  }
  
  return {
    allowed: true,
    remaining: MAX_DAILY_GENERATIONS - data.count,
  };
};

// 生成回数を記録
export const recordGeneration = (): void => {
  const data = getUsageData();
  data.count += 1;
  data.lastGenerationTime = Date.now();
  saveUsageData(data);
};

// 残り回数を取得
export const getRemainingGenerations = (): number => {
  const data = getUsageData('generate');
  return Math.max(0, MAX_DAILY_GENERATIONS - data.count);
};

// 汎用的なレート制限チェック
export const checkRateLimit = (type: 'generate' | 'edit'): boolean => {
  const data = getUsageData(type);
  
  // 1日の上限チェック
  if (data.count >= MAX_DAILY_GENERATIONS) {
    return false;
  }
  
  // クールダウンチェック
  const now = Date.now();
  const timeSinceLastGeneration = (now - data.lastGenerationTime) / 1000;
  
  if (timeSinceLastGeneration < COOLDOWN_SECONDS) {
    return false;
  }
  
  // 使用回数を記録
  data.count += 1;
  data.lastGenerationTime = Date.now();
  saveUsageData(data, type);
  
  return true;
};

// 汎用的な残り回数取得
export const getRemainingCount = (type: 'generate' | 'edit'): number => {
  const data = getUsageData(type);
  return Math.max(0, MAX_DAILY_GENERATIONS - data.count);
};
