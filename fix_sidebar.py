import re  
  
with open(r'C:\Users\ANIM\yard\app\admin\page.tsx', 'r', encoding='utf-8') as f:  
    content = f.read()  
  
# 1. Update sidebar width from 280px to 260px  
content = content.replace('w-[280px]', 'w-[260px]')  
  
# 2. Update SectionKey type to include Settings  
content = content.replace(  
