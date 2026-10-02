-- One-off: convert brand values saved as English (old website uploads) to the Arabic label
-- that the app, admin panel and edit form all store. Mapping generated from lib/brands.ts.
-- Brands spelled the same in both (H&M, ASOS, DKNY, LC Waikiki) are untouched.

-- 1) Preview: how many listings each mapping will change
select brand, count(*) from products
where brand in ('Adidas', 'Aldo', 'Armani', 'Badgley Mischka', 'Balenciaga', 'Bershka', 'Burberry', 'Calvin Klein', 'Carter''s', 'Chanel', 'Champion', 'Coast', 'Coach', 'Defacto', 'Dior', 'Dune', 'Fendi', 'Fossil', 'Gap', 'Gizia', 'Gucci', 'Guess', 'Hugo Boss', 'Karen Millen', 'Kate Spade', 'Lacoste', 'Levi''s', 'Louis Vuitton', 'Mango', 'Marks & Spencer', 'Massimo Dutti', 'Michael Kors', 'Monsoon', 'Mothercare', 'New Balance', 'Next', 'Nike', 'Nine West', 'Pandora', 'Polo', 'Prada', 'Pull & Bear', 'Puma', 'Rado', 'Ralph Lauren', 'Reebok', 'River Island', 'Sherri Hill', 'Steve Madden', 'Stradivarius', 'Swarovski', 'Ted Baker', 'Tommy Hilfiger', 'Tory Burch', 'Under Armour', 'Valentino', 'Versace', 'Zara', 'Custom Made', 'Other')
group by brand order by count(*) desc;

-- 2) Convert
update products p
set brand = m.label
from (values
  ('Adidas', 'أديداس'),
  ('Aldo', 'ألدو'),
  ('Armani', 'أرماني'),
  ('Badgley Mischka', 'بادجلي ميشكا'),
  ('Balenciaga', 'بالنسياغا'),
  ('Bershka', 'بيرشكا'),
  ('Burberry', 'بربري'),
  ('Calvin Klein', 'كالفن كلاين'),
  ('Carter''s', 'كارتر'),
  ('Chanel', 'شانيل'),
  ('Champion', 'تشامبيون'),
  ('Coast', 'كوست'),
  ('Coach', 'كوتش'),
  ('Defacto', 'ديفاكتو'),
  ('Dior', 'ديور'),
  ('Dune', 'ديون'),
  ('Fendi', 'فندي'),
  ('Fossil', 'فوسيل'),
  ('Gap', 'GAP'),
  ('Gizia', 'جيزيا'),
  ('Gucci', 'غوتشي'),
  ('Guess', 'غيس'),
  ('Hugo Boss', 'هوغو بوس'),
  ('Karen Millen', 'كارن ميلن'),
  ('Kate Spade', 'كيت سبيد'),
  ('Lacoste', 'لاكوست'),
  ('Levi''s', 'ليفايز'),
  ('Louis Vuitton', 'لويس فيتون'),
  ('Mango', 'مانجو'),
  ('Marks & Spencer', 'ماركس أند سبنسر'),
  ('Massimo Dutti', 'ماسيمو دوتي'),
  ('Michael Kors', 'مايكل كورس'),
  ('Monsoon', 'مونسون'),
  ('Mothercare', 'مازر كير'),
  ('New Balance', 'نيو بالانس'),
  ('Next', 'نكست'),
  ('Nike', 'نايك'),
  ('Nine West', 'ناين ويست'),
  ('Pandora', 'باندورا'),
  ('Polo', 'بولو'),
  ('Prada', 'برادا'),
  ('Pull & Bear', 'بول أند بير'),
  ('Puma', 'بوما'),
  ('Rado', 'رادو'),
  ('Ralph Lauren', 'رالف لورن'),
  ('Reebok', 'ريبوك'),
  ('River Island', 'ريفر أيلاند'),
  ('Sherri Hill', 'شيري هيل'),
  ('Steve Madden', 'ستيف مادن'),
  ('Stradivarius', 'ستراديفاريوس'),
  ('Swarovski', 'سواروفسكي'),
  ('Ted Baker', 'تيد بيكر'),
  ('Tommy Hilfiger', 'تومي هيلفيغر'),
  ('Tory Burch', 'توري بيرش'),
  ('Under Armour', 'أندر آرمور'),
  ('Valentino', 'فالنتينو'),
  ('Versace', 'فيرساتشي'),
  ('Zara', 'زارا'),
  ('Custom Made', 'تفصيل'),
  ('Other', 'أخرى')
) as m(english, label)
where p.brand = m.english;

-- 3) Check: should return no rows
select brand, count(*) from products where brand ~ '^[A-Za-z]' and brand not in ('H&M', 'ASOS', 'DKNY', 'LC Waikiki', 'GAP') group by brand;
