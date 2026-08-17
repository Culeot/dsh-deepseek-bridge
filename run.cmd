@echo off
cd /d C:\ai项目\dsh-deepseek-bridge
node src/index.js --keep-open --project "xiaoxue-shuxue-final" "项目背景:人教版小学数学1-6年级上册教辅已完成(676份MD+676份PDF),下册12册待做。流水线脚本:md2tex.py+build_all.py。排版已升级为单色黑白(禁止颜色区分)。文件命名:{年级}_{类型}_{单元}.{md|pdf}。问题:如何高效复用上册流水线生成下册12册?需要注意哪些版本差异和坑?请给出具体可操作的方案。"
pause
