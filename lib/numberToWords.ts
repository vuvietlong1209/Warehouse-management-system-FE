/**
 * Chuẩn hóa hàm đọc số tiền thành chữ Tiếng Việt
 * Ví dụ: 50000000 -> "Năm mươi triệu đồng chẵn"
 *       1500000  -> "Một triệu năm trăm nghìn đồng chẵn"
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readTriple(hundred: number, ten: number, unit: number, isFirstGroup: boolean): string {
  let result = '';

  if (hundred === 0 && ten === 0 && unit === 0) {
    return '';
  }

  // Đọc hàng trăm
  if (!isFirstGroup || hundred !== 0) {
    result += DIGITS[hundred] + ' trăm ';
  }

  // Đọc hàng chục
  if (ten === 0 && unit !== 0) {
    if (!isFirstGroup || hundred !== 0) {
      result += 'lẻ ';
    }
  } else if (ten === 1) {
    result += 'mười ';
  } else if (ten > 1) {
    result += DIGITS[ten] + ' mươi ';
  }

  // Đọc hàng đơn vị
  if (unit === 1) {
    if (ten > 1) {
      result += 'mốt ';
    } else {
      result += DIGITS[unit] + ' ';
    }
  } else if (unit === 5) {
    if (ten > 0) {
      result += 'lăm ';
    } else {
      result += DIGITS[unit] + ' ';
    }
  } else if (unit > 0) {
    result += DIGITS[unit] + ' ';
  }

  return result;
}

export function numberToVietnameseWords(value: number | string): string {
  let num = Math.floor(Math.abs(Number(value) || 0));
  if (num === 0) return 'Không đồng chẵn';

  const UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const triples: number[][] = [];

  while (num > 0) {
    const unit = num % 10;
    num = Math.floor(num / 10);
    const ten = num % 10;
    num = Math.floor(num / 10);
    const hundred = num % 10;
    num = Math.floor(num / 10);
    triples.push([hundred, ten, unit]);
  }

  let words = '';
  for (let i = triples.length - 1; i >= 0; i--) {
    const [h, t, u] = triples[i];
    const isFirst = i === triples.length - 1;
    const tripleText = readTriple(h, t, u, isFirst);
    if (tripleText.trim() !== '') {
      words += tripleText + UNITS[i] + ' ';
    }
  }

  words = words.trim();
  if (!words) return 'Không đồng chẵn';

  // Viết hoa chữ cái đầu và thêm 'đồng chẵn'
  words = words.charAt(0).toUpperCase() + words.slice(1) + ' đồng chẵn';
  return words.replace(/\s+/g, ' ');
}

export default numberToVietnameseWords;
