# Piece-type formula reference

Auto-dumped from `Sign365 LN Estimate Template - Blank.xlsx` by
`scripts/dump-piece-formulas.py`. This is the canonical source for the
math each `apps/estimating/src/data/pieceTypes.ts` entry should
implement. Cell formulas are shown as `value ← =formula`. Re-run the
script after any workbook update.

## `Freeform time and material`

```
r 1  A: 'Freeform time and material'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'
r 6  A: 'ALL MANUAL INPUT'
r 9  A: 'Total sign price'  B: 0 ← =SUM(I17:I44)
r14  A: 'Inventory items'
r15  A: 'Choose all inventory items needed by des…'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  H: None ← =IF($B$46<>0,$B$46,"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop Labor'  G: 'Enter Estimated Hours needed'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  G: 0  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  G: 0  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  G: 0  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  G: 0  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  G: 0  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'
---
```

## `Vinyl cutting`

```
r 1  A: 'Cut vinyl           (usually only one or…'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'
r 6  A: 'Quantity to cut?'  B: 0
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Total sign price'  B: 0 ← =SUM(I17:I44)
r14  A: 'Inventory Items'
r15  A: 'Choose masking and vinyl by description …'  H: 'Calculated units suggestion only'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  H: None ← =IF($B$46<>0,$B$46,"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop Labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  D: 'Sqft to Process'  E: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2415  B: 'Graphics Cut Weed & Mask Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 0 ← =B46  E: 20 ← =B47  G: 0 ← =CEILING(D33/E33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'sqft '  B: 0 ← =CEILING((B7*B8)/144,4)*B6  C: 'default work code'  D: 2415
r47  A: 'Vinyl cut/weed/mask sqft/hour'  B: 20 ← =RateData!B1
---
```

## `Apply vinyl graphics`

```
r 1  A: 'Apply Vinyl Graphics'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'
r 5  B: 'Flat'  C: '<< Choose Flat or Push Through surface a…'
r 6  A: 'Quantity to apply?'  B: 0
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r14  A: 'Inventory items'
r15  A: 'Choose vinyl inventory items and Units N…'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2416  B: 'Graphics Application Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 32 ← =IF(B5<>"Flat",B48,B47)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  D: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  C: 'default work code'  D: 2416  F: 'Flat'
r47  A: 'Vinyl application flat surface sqft/hour'  B: 32 ← =RateData!B2  F: 'Push Through'
r48  A: 'Vinyl application push through sqft/hour'  B: 15 ← =RateData!B3
---
```

## `Alum pan sign`

```
r 1  A: 'Alum pan sign without graphics'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 4  B: 'Rectangular'  C: '<<<Choose Rectangular or Radius/Angle sh…'
r 5  B: 0  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of pans?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth? (2" std)'  B: 2
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 1.9 ← =VLOOKUP(E33,A57:B61,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53  F: 43.75 ← =B48  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53  F: 28.5 ← =B49  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'Extra color masking'  G: 0 ← =IF(B53<>0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'Radius/Angle '  G: 0 ← =IF(B4="Radius/Angle",G33*H53,0)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  D: 'Extra paint color percentage'  E: 0.1 ← =RateData!B5  G: 0  H: 'number of colors list'
r47  D: 'extra paint color materials'  E: 0 ← =B53*B50*E46*B5  G: 1
r48  A: 'Pan paint prep sqft/hour'  B: 43.75 ← =RateData!B8  G: 2
r49  A: 'Pan paint sqft/hour'  B: 28.5 ← =RateData!B9  G: 3
r50  A: 'Grams of paint/sqft'  B: 100 ← =RateData!B4  G: 4
r51  A: 'perimeter'  B: 0 ← =(((B7+B8)*2)/12)*B6  G: 5
r52  A: 'area of filler'  B: 0 ← =(B9/12)*B51  G: 'Rectangular'  H: 0
r53  A: 'paint area w/filler'  B: 0 ← =B46+B52  G: 'Radius/Angle'  H: 0.25 ← =RateData!B16
r56  A: 'speed table lookup '
r57  A: 0 ← =RateData!B47  B: 1.9 ← =RateData!D47
r58  A: 5 ← =RateData!B48  B: 3.8 ← =RateData!D48
r59  A: 25 ← =RateData!B49  B: 6.65 ← =RateData!D49
r60  A: 40 ← =RateData!B50  B: 9.5 ← =RateData!D50
r61  A: 50 ← =RateData!B51  B: 6.65 ← =RateData!D51
---
```

## `Economy pan sign`

```
r 1  A: 'Economy Pan Sign'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of pans?'  B: 1
r 7  A: 'Height inches? (44" max)'  B: 0  C: '<<< 44" max'
r 8  A: 'Length inches? (116 max")'  B: 0  C: '<<< 116 max"'
r 9  A: 'Depth only as 2"'  B: 2  C: '<<< 2" only'
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 1.9 ← =VLOOKUP(E33,D48:E52,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  D: 'Data in RateData sheet'
r47  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  D: 'speed table lookup '
r48  A: 'perimeter'  B: 0 ← =(((B7+B8)*2)/12)*B6  D: 0 ← =RateData!B47  E: 1.9 ← =RateData!D47
r49  A: 'area of filler'  B: 0 ← =(B9/12)*B48  D: 5 ← =RateData!B48  E: 3.8 ← =RateData!D48
r50  A: 'pre-painted aluminum sheets used'  B: 1 ← =B6  D: 25 ← =RateData!B49  E: 6.65 ← =RateData!D49
r51  A: 'pre-painted alum sheet sqft'  B: 40  D: 40 ← =RateData!B50  E: 9.5 ← =RateData!D50
r52  D: 50 ← =RateData!B51  E: 6.65 ← =RateData!D56
---
```

## `Post and panel sign`

```
r 1  A: 'Post and Panel sign'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 4  B: 'Rectangular'  C: '<<<Choose Rectangular or Radius/Angle sh…'
r 5  B: 0  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of signs?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 3  C: '<<< Choose post depth only 2", 3" or 4"'
r10  A: 'Number of posts?'  B: 0
r11  A: 'Length of post inches?'  B: 0
r12  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'  B: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'  B: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'body'  E: 0 ← =B46  F: 0.95 ← =VLOOKUP(E33,A60:B64,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'posts'  E: 0 ← =B52  F: 24 ← =B56  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'body'  E: 0 ← =B55  F: 15 ← =B47  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'body'  E: 0 ← =B55  F: 15 ← =B47  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'posts'  E: 0 ← =B53  F: 15 ← =B47  G: 0 ← =CEILING(E37/F37,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'posts'  E: 0 ← =B53  F: 15 ← =B48  G: 0 ← =CEILING(E38/F38,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G38*H38,"")
r39  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'Extra color masking'  G: 0 ← =IF(B57<>0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'Radius/Angle '  G: 0 ← =IF(B4="Radius/Angle",G33*H53,0)  H: 97 ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  C: 'post size list'  D: 2  E: 'Extra paint color percentage'  F: 0.1 ← =RateData!B5  G: 0  H: 'number of colors list'
r47  A: 'Post & panel paint prep/sqft/hour'  B: 15 ← =RateData!B10  D: 3  E: 'extra paint color materials'  F: 0 ← =B5*F46*B57*B49  G: 1
r48  A: 'Post & panel paint sqft/hour'  B: 15 ← =RateData!B11  D: 4  G: 2
r49  A: 'Grams of paint/sqft'  B: 100 ← =RateData!B4  G: 3
r50  A: 'perimeter'  B: 0 ← =(((B8+B10)*2)/12)*B6  G: 4
r51  A: 'sqft of faces'  B: 0 ← =B46*2  G: 5
r52  A: 'feet of post'  B: 0 ← =(B11*B10/12)*B6  G: 'Rectangular'  H: 0
r53  A: 'Area of posts to paint'  B: 0 ← =(B9/12)*4*B52  G: 'Radius/Angle'  H: 0.25 ← =RateData!B16
r54  A: 'area of filler'  B: 0 ← =(B9/12)*B50
r55  A: 'body area to paint'  B: 0 ← =B54+B51
r56  A: 'Post & panel feet of post fab feet/hour'  B: 24 ← =RateData!B17
r57  A: 'total post and panel paint area'  B: 0 ← =B53+B55
r59  A: 'speed table lookup '
r60  A: 0 ← =RateData!B52  B: 0.95 ← =RateData!D52
r61  A: 4 ← =RateData!B53  B: 1.9 ← =RateData!D53
r62  A: 10 ← =RateData!B54  B: 2.85 ← =RateData!D54
r63  A: 20 ← =RateData!B55  B: 3.8 ← =RateData!D55
r64  A: 30 ← =RateData!B56  B: 6.65 ← =RateData!D56
---
```

## `Flat panels only`

```
r 1  A: 'Flat Panel Face No Graphics (Acrylic, Po…'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of panels?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Substrate material?'  B: 'Acrylic'  C: '<<<Choose Acrylic, Polycarbonate, ACM or…'
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2312  B: 'Plastic Face Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =CEILING(B46,10)  F: 72 ← =(VLOOKUP(B9,A49:D52,4,FALSE))  G: 0 ← =IF(OR(B9="ACRYLIC",B9="POLYCARBONATE"),CEILING(E33/F33,RateData!B84),0)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =CEILING(B46,10)  F: 72 ← =(VLOOKUP(B9,A49:D52,4,FALSE))  G: 0 ← =IF(OR(B9="ACM",B9="Pre-Paint Aluminum"),CEILING(E34/F34,RateData!B84),0)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'Sqft'  B: 0 ← =(B7*B8/144)*B6
r48  A: 'Speed table'
r49  A: 'Acrylic'  D: 72 ← =RateData!B23
r50  A: 'PolyCarbonate'  D: 48 ← =RateData!B24
r51  A: 'ACM'  D: 96 ← =RateData!B25
r52  A: 'Pre-Paint Aluminum'  D: 96 ← =RateData!B26
---
```

## `Routed panel shapes`

```
r 1  A: 'Routed Panel Shapes Aluminum or Acrylic '
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of panels?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Material'  B: 'Aluminum .125'  C: '<<<Choose Aluminum or Acrylic'
r10  A: 'Total price'  B: 0 ← =SUM(I18:I45)
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E31*G31,"")
r32  A: 'Shop labor'
r33  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r34  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'setup'  G: 0 ← =IF(B47<>0,B49,0)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 50 ← =B48  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  B: None ← =IFERROR(VLOOKUP(A45,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A45,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G45*H45,"")
r46  A: 'Formula calculation details below DO NOT…'  D: 'Data in RateData sheet'
r47  A: 'sqft'  B: 0 ← =B7*B8*B6/144  E: 'Aluminum .125'
r48  A: 'Routed panel shape sqft/hour'  B: 50 ← =RateData!B29  C: 'sqft/hr'  E: 'White Acrylic'
r49  A: 'Router setup hours'  B: 1 ← =RateData!B27
---
```

## `Routed face only`

```
r 1  A: 'Routed Face with Paint and Acrylic Backe…'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of faces?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 1
r10  A: 'Inches of copy?'  B: 0
r11  A: 'Push through copy option?'  B: 'No'  C: '<<< Choose yes or no'
r12  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Inches or Sqft to Process'  F: 'Sqft or Inches/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'setup'  G: 0 ← =IF(B46<>0,D53,0)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'Alum copy routing rate inches'  E: 0 ← =B10*D52  F: 200 ← =D47  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'setup'  G: 0 ← =IF(B46<>0,D53,0)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'acrylic'  E: 0 ← =IF(B11<>"no",0,B48)  F: 50 ← =D46  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'Push thru acrylic'  E: 0 ← =IF(B11<>"yes",0,B10*D52)  F: 100 ← =D48  G: 0 ← =CEILING(E37/F37,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B48  F: 6 ← =D50  G: 0 ← =CEILING(E38/F38,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G38*H38,"")
r39  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 19 ← =B51  G: 0 ← =CEILING(E39/F39,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 23.75 ← =B52  G: 0 ← =CEILING(E40/F40,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G40*H40,"")
r41  A: 2313  B: 'Routed Face Labor' ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 60 ← =D51  G: 0 ← =CEILING(E41/F41,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G41*H41,"")
r42  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 15 ← =D49  G: 0 ← =CEILING(E42/F42,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  C: 'Routed panel shape sqft/hour'  D: 50 ← =RateData!B29
r47  A: 'perimeter ft'  B: 0 ← =((B7+B8*2)/12)*B6  C: 'Routing aluminum inches/hour'  D: 200 ← =RateData!B30
r48  A: 'sqft of faces'  B: 0 ← =B46  C: 'Routing push through acrylic inches/hour'  D: 100 ← =RateData!B31
r49  A: 'sqft of filler'  B: 0 ← =B9/12*B47  C: 'Routed backer assembly sqft/hour'  D: 15 ← =RateData!B33
r50  A: 'paint area w/filler'  B: 0 ← =B49+B48  C: 'Routed face fabrication rate sqft/hour'  D: 6 ← =RateData!B34
r51  A: 'Cabinet paint prep sqft/hour'  B: 19 ← =RateData!B6  C: 'Routed pop stud sqft/hour'  D: 60 ← =RateData!B32
r52  A: 'Cabinet paint sqft/hour'  B: 23.75 ← =RateData!B7  C: 'Letter perimeter path factor'  D: 6 ← =RateData!B28
r53  A: 'Grams of paint/sqft'  B: 100 ← =RateData!B4  C: 'Router setup hours'  D: 1 ← =RateData!B27
r54  C: 'Yes'
r55  C: 'No'
---
```

## `Routed alum faces letters`

```
r 1  A: 'Routed Aluminum Faces or Letters NO PAIN…'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of panels?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Total inches of copy?'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Inches to Process'  F: 'Inches/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'setup'  G: 0 ← =IF(B46<>0,B50,0)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B49  F: 200 ← =B47  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  D: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =B7*B8*B6/144
r47  A: 'Routing aluminum inches/hour'  B: 200 ← =RateData!B30
r48  A: 'Letter perimeter path factor'  B: 6 ← =RateData!B28
r49  A: 'inches to rout'  B: 0 ← =B9*B48*B6
r50  A: 'Router setup hours'  B: 1 ← =RateData!B27
---
```

## `Routed push through acrylic`

```
r 1  A: 'Routed Push Through Acrylic'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of panels?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Total inches of copy?'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Inches to Process'  F: 'Inches/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'setup'  G: 0 ← =IF(B46<>0,B50,0)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B49  F: 100 ← =B47  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  D: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =B7*B8*B6/144
r47  A: 'Routing push through acrylic inches/hour'  B: 100 ← =RateData!B31
r48  A: 'Letter perimeter path factor'  B: 6 ← =RateData!B28
r49  A: 'inches to rout'  B: 0 ← =B9*B48*B6
r50  A: 'Router setup hours'  B: 1 ← =RateData!B27
---
```

## `Sf routed cabinet`

```
r 1  A: 'Single face routed cabinet'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 4  B: 'Rectangular'  C: '<<< Choose Rectangular or Radius/Angle s…'
r 5  B: 0  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of signs?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 0
r10  A: 'Inches of routed copy?'  B: 0
r11  A: 'Push through copy option?'  B: 'No'  C: '<<< Choose yes or no'
r12  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: 'Estimate for Misc Hardware & Adhesive Ma…'  B: 'EST HARDWARE-ADHESIV' ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 0 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 3 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'SQFT' ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =CEILING(B46,1)  I: 0 ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Inches or Sqft to Process'  F: 'Sqft or Inches/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'setup'  G: 0 ← =IF(B46<>0,B52,0)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'copy'  E: 0 ← =B10*B53  F: 200 ← =E47  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'backer'  E: 0 ← =IF(B11<>"no",0,B46)  F: 50 ← =E46  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'push thru'  E: 0 ← =IF(B11<>"yes",0,B10*B53)  F: 100 ← =E48  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B46  F: 0.95 ← =VLOOKUP(B46,A60:B63,2,TRUE)  G: 0 ← =CEILING(E37/F37,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  A: 2011  B: 'Cabinet Metal Labor'  C: 'radius/angle factor'  G: 0 ← =IF(B4="Radius/Angle",G37*G51,0)  H: 97 ← =H37  I: 0 ← =G38*H38
r39  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B46  F: 19 ← =E49  G: 0 ← =CEILING(E39/F39,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B46  F: 23.75 ← =E50  G: 0 ← =CEILING(E40/F40,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G40*H40,"")
r41  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B46  F: 14.25 ← =E51  G: 0 ← =CEILING(E41/F41,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G41*H41,"")
r42  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B46  F: 15 ← =G52  G: 0 ← =CEILING(E42/F42,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G42*H42,"")
r43  A: 2313  B: 'Routed Face Labor' ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'popstuds'  E: 0 ← =B46  F: 60 ← =E54  G: 0 ← =CEILING(E43/F43,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G43*H43,"")
r44  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'extra color'  G: 0 ← =IF(B51<> 0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  D: 'Routed panel shape sqft/hour'  E: 50 ← =RateData!B29  F: 'Extra paint color percentage'  G: 0.1 ← =RateData!B5
r47  A: 'perimeter ft'  B: 0 ← =(((B7+B8)*2)/12)*B6  D: 'Routing aluminum inches/hour'  E: 200 ← =RateData!B30  F: 'Extra paint color material'  G: 0 ← =B5*B51*E52*G46
r48  A: 'perimeter ft X 2'  B: 0 ← =B47*2*B6  D: 'Routing push through acrylic inches/hour'  E: 100 ← =RateData!B31  F: 'Synergy 24 volt LEDs/sqft'  G: 1.3 ← =RateData!B19
r49  A: 'perimeter ft X3'  B: 0 ← =B47*3*B6  D: 'Cabinet paint prep sqft/hour'  E: 19 ← =RateData!B6  F: 'Synergy 24 volt LEDs/power supply'  G: 108 ← =RateData!B20
r50  A: 'sqft of filler'  B: 0 ← =B47*(B9/12)  D: 'Cabinet paint sqft/hour'  E: 23.75 ← =RateData!B7  F: 'Rectangular'  G: 0
r51  A: 'paint area w/filler'  B: 0 ← =B50+B46  D: 'LED wiring sqft/hour'  E: 14.25 ← =RateData!B18  F: 'Radius/Angle'  G: 0.25 ← =RateData!B16
r52  A: 'Router setup hours X 2 (1 aluminum & 1 a…'  B: 2 ← =RateData!B27*2  D: 'Grams of paint/sqft'  E: 100 ← =RateData!B4  F: 'Routed backer assembly sqft/hour'  G: 15 ← =RateData!B33
r53  A: 'Letter perimeter path factor'  B: 6 ← =RateData!B28  D: 'Quickmod 12 volt LEDs/sqft'  E: 1.5 ← =RateData!B21  F: 0  G: 'number of colors list'
r54  C: 'Yes'  D: 'Routed pop stud sqft/hour'  E: 60 ← =RateData!B32  F: 1
r55  C: 'No'  D: 'LEDs 1 sign'  E: 0 ← =(((B7*B8)/144))*G48  F: 2
r56  D: 'Power supplies 1 sign'  E: 0 ← =ROUNDUP(E55/G49,0)  F: 3
r57  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22  F: 4
r58  F: 5
r59  A: 'speed table lookup'
r60  A: 0 ← =RateData!B57  B: 0.95 ← =RateData!D57
r61  A: 4 ← =RateData!B58  B: 1.9 ← =RateData!D58
r62  A: 8 ← =RateData!B59  B: 2.38 ← =RateData!D59
r63  A: 20 ← =RateData!B60  B: 2.85 ← =RateData!D60
---
```

## `Df routed cabinet`

```
r 1  A: 'Double face routed cabinet'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 4  B: 'Rectangular'  C: '<<< Choose Rectangular or Radius/Angle s…'
r 5  B: 0  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of signs?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 0
r10  A: 'Inches of routed copy'  B: 0
r11  A: 'Push through copy option?'  B: 'No'  C: '<<< Choose yes or no'
r12  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: 'Estimate for Misc Hardware & Adhesive Ma…'  B: 'EST HARDWARE-ADHESIV' ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 0 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 3 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'EA'  G: 0 ← =CEILING(B47,1)  I: 0 ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Inches or Sqft to Process'  F: 'Sqft or Inches/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'setup'  G: 0 ← =IF(B47<>0,B57,0)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'copy'  E: 0 ← =B10*B58*B46*B6  F: 200 ← =E47  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'backer'  E: 0 ← =IF(B11<>"no",0,B51)  F: 50 ← =E46  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2010  B: 'Routing Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'push thru'  E: 0 ← =IF(B11<>"yes",0,B10*B58*B46*B6)  F: 100 ← =E48  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B47  F: 0.95 ← =VLOOKUP(B47,A62:B65,2,TRUE)  G: 0 ← =CEILING(E37/F37,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  A: 2011  B: 'Cabinet Metal Labor'  C: 'radius/angle factor'  G: 0 ← =IF(B4="Radius/Angle",G37*I54,0)  H: 97 ← =H37  I: 0 ← =G38*H38
r39  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B53  F: 19 ← =E49  G: 0 ← =CEILING(E39/F39,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B53  F: 23.75 ← =E50  G: 0 ← =CEILING(E40/F40,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G40*H40,"")
r41  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B51  F: 14.25 ← =E51  G: 0 ← =CEILING(E41/F41,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G41*H41,"")
r42  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B51  F: 15 ← =G50  G: 0 ← =CEILING(E42/F42,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G42*H42,"")
r43  A: 2313  B: 'Routed Face Labor' ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: ''  E: 0 ← =B51  F: 60 ← =E55  G: 0 ← =CEILING(E43/F43,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G43*H43,"")
r44  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'extra color'  G: 0 ← =IF(B53<> 0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r46  A: 'Double face spreadsheet'  B: 2  D: 'Routed panel shape sqft/hour'  E: 50 ← =RateData!B29  F: 'Extra paint color percentage'  G: 0.1 ← =RateData!B5  H: 'number of colors'  I: 0
r47  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  D: 'Routing aluminum inches/hour'  E: 200 ← =RateData!B30  F: 'extra paint color materials'  G: 0 ← =B53*E53*G46*B5  I: 1
r48  A: 'perimeter ft'  B: 0 ← =(((B7+B8)*2)/12)*B6  D: 'Routing push through acrylic inches/hour'  E: 100 ← =RateData!B31  F: 'Synergy 24 volt LEDs/sqft'  G: 1.3 ← =RateData!B19  I: 2
r49  A: 'perimeter ft X 2'  B: 0 ← =B48*2  D: 'Cabinet paint prep sqft/hour'  E: 19 ← =RateData!B6  F: 'Synergy 24 volt LEDs/power supply'  G: 108 ← =RateData!B20  I: 3
r50  A: 'perimeter ft X3'  B: 0 ← =B48*3  D: 'Cabinet paint sqft/hour'  E: 23.75 ← =RateData!B7  F: 'Routed backer assembly sqft/hour'  G: 15 ← =RateData!B36  I: 4
r51  A: 'sqft of faces'  B: 0 ← =B47*B46  D: 'LED wiring sqft/hour'  E: 14.25 ← =RateData!B18  I: 5
r52  A: 'sqft of filler'  B: 0 ← =B48*(B9/12)
r53  A: 'paint area w/filler'  B: 0 ← =B52+B51  D: 'Grams of paint/sqft'  E: 100 ← =RateData!B4  H: 'Rectangular'  I: 0
r54  A: 'pole nest ft'  B: 0 ← =CEILING(B9*4/12*B6,10)  D: 'Quickmod 12 volt LEDs/sqft'  E: 1.5 ← =RateData!B21  H: 'Radius/Angle'  I: 0.25 ← =RateData!B16
r55  A: 'routed ACM supports ft'  B: 0 ← =CEILING(B8*4/12*B6,10)  D: 'Routed pop stud sqft/hour'  E: 60 ← =RateData!B32
r56  A: 'ACM sheets'  B: 0 ← =CEILING(B51/32,0.5)  D: 'LEDs 1 sign'  E: 0 ← =(((B7*B8)/144)*B46)*G48  F: '\xa0'
r57  A: 'Router setup hours X 2 (1 aluminum & 1 a…'  B: 2 ← =RateData!B27*2  D: 'Power supplies 1 sign'  E: 0 ← =ROUNDUP(E56/G49,0)  F: '\xa0'
r58  A: 'Letter perimeter path factor'  B: 6 ← =RateData!B28  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22
r61  A: 'speed table lookup'  E: 'Yes'
r62  A: 0 ← =RateData!B57  B: 0.95 ← =RateData!D57  E: 'No'
r63  A: 4 ← =RateData!B58  B: 1.9 ← =RateData!D58
r64  A: 8 ← =RateData!B59  B: 2.38 ← =RateData!D59
r65  A: 20 ← =RateData!B60  B: 2.85 ← =RateData!D60
---
```

## `Sf acrylic cabinet`

```
r 1  A: 'Sf Acrylic cabinet'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 4  B: 'Acrylic'  C: '<<< Choose White acrylic or White Polyca…'
r 5  B: 'Rectangular'  C: '<<< Choose Rectangular or Radius/Angle s…'
r 6  B: 0  C: '<<< Choose number of extra paint colors …'
r 7  B: 1  C: '<<< Rows of Divider Bar'
r 8  A: 'Number of signs?'  B: 1
r 9  A: 'Height inches?'  B: 0
r10  A: 'Length inches?'  B: 0
r11  A: 'Depth inches?'  B: 0
r12  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 0.95 ← =VLOOKUP(E33,A58:B61,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B52  F: 19 ← =E49  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B52  F: 23.75 ← =E50  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 14.25 ← =E51  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 40 ← =H46  G: 0 ← =CEILING(E37/F37,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  A: 2312  B: 'Plastic Face Labor' ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 72 ← =E48  G: 0 ← =CEILING(E38/F38,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G38*H38,"")
r39  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'extra color'  G: 0 ← =IF(B52<> 0,B6,0)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'radius/angles'  G: 0 ← =IF(B5="Radius/Angle",CEILING(G33*H50,RateData!B84),0)  H: 97 ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G40*H40,"")
r41  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'divider bar labor'  E: 0 ← =(B7*B10*B8)/12  F: 8 ← =E57  G: 0 ← =IF(B7<>0,CEILING(E41/F41,RateData!B84),0)  H: 97 ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B9*B10/144)*B8  D: 'Grams of paint/sqft'  E: 100 ← =RateData!B4  G: 'Retainer assembly sqft/hour'  H: 40 ← =RateData!B35
r47  A: 'perimeter ft'  B: 0 ← =(((B9+B10)*2)/12)*B8  D: 'Quickmod 12 volt LEDs/sqft'  E: 1.5 ← =RateData!B21  G: 'Extra paint color percentage'  H: 0.1 ← =RateData!B5
r48  A: 'perimeter ft X 2'  B: 0 ← =B47*2  D: 'Acrylic cut sqft/hour'  E: 72 ← =RateData!B23  G: 'extra paint color materials'  H: 0 ← =B52*H47*B6*E46
r49  A: 'perimeter ft X3'  B: 0 ← =B47*3  D: 'Cabinet paint prep sqft/hour'  E: 19 ← =RateData!B6  G: 'Rectangular'  H: 0
r50  A: 'sqft of faces'  B: 0 ← =B46  D: 'Cabinet paint sqft/hour'  E: 23.75 ← =RateData!B7  G: 'Radius/Angle'  H: 0.25 ← =RateData!B16
r51  A: 'sqft of filler'  B: 0 ← =B47*(B11/12)  D: 'LED wiring sqft/hour'  E: 14.25 ← =RateData!B18
r52  A: 'paint area w/filler'  B: 0 ← =B51+B53  D: 'LEDs 1 sign'  E: 0 ← =(((B9*B10)/144))*E55
r53  A: 'retainer ft'  B: 0 ← =B47  D: 'Power supplies 1 sign'  E: 0 ← =ROUNDUP(E52/E56,0)  F: '\xa0'
r54  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22  F: '\xa0'  G: 0  H: 'number of colors'
r55  D: 'Synergy 24 volt LEDs/sqft'  E: 1.3 ← =RateData!B19  G: 1
r56  D: 'Synergy 24 volt LEDs/power supply'  E: 108 ← =RateData!B20  G: 2
r57  A: 'speed table lookup'  D: 'Divider bar ft/hr'  E: 8 ← =RateData!B85  G: 3
r58  A: 0 ← =RateData!B61  B: 0.95 ← =RateData!D61  G: 4
r59  A: 4 ← =RateData!B62  B: 1.9 ← =RateData!D62  G: 5
r60  A: 8 ← =RateData!B63  B: 2.85 ← =RateData!D63  D: 'Acrylic'  E: 'Rectangular'  G: 0  H: 'number of divider bars'
r61  A: 18 ← =RateData!B64  B: 3.8 ← =RateData!D64  D: 'Polycarbonate'  E: 'Radius/Angle'  G: 1
r62  G: 2
r63  G: 3
r64  G: 4
r65  G: 5
r66  G: 6
r67  G: 7
r68  G: 8
r69  G: 9
r70  G: 10
---
```

## `Economy Sf acrylic`

```
r 1  A: 'Sf Economy Acrylic cabinet (prepainted a…'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of signs?'  B: 1
r 7  A: 'Height inches? (36" max)'  B: 0  C: '<<< 36" max'
r 8  A: 'Length inches? (120" max)'  B: 0  C: '<<< 120" max'
r 9  A: 'Depth is 6" only'  B: 6  C: '<<< 6" only'
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 0.95 ← =VLOOKUP(E33,A58:B61,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 14.25 ← =E52  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 40 ← =H48  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2312  B: 'Plastic Face Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 72 ← =E49  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r46  A: 'depth inches default'  B: 6  G: 'Synergy 24 volt LEDs/sqft'  H: 1.3 ← =RateData!B19
r47  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  D: 'Quickmod 12 volt LEDs/sqft'  E: 1.5 ← =RateData!B21  G: 'Synergy 24 volt LEDs/power supply'  H: 108 ← =RateData!B20
r48  A: 'perimeter ft'  B: 0 ← =(((B7+B8)*2)/12)*B6  G: 'Retainer assembly sqft/hour'  H: 40 ← =RateData!B35
r49  A: 'perimeter ft X 2'  B: 0 ← =B48*2  D: 'Acrylic cut sqft/hour'  E: 72 ← =RateData!B23
r50  A: 'perimeter ft X3'  B: 0 ← =B48*3
r51  A: 'sqft filler'  B: 0 ← =B48*(B46/12)
r52  A: 'Area back&filler'  B: 0 ← =B51+B47  D: 'LED wiring sqft/hour'  E: 14.25 ← =RateData!B18
r53  A: 'Pre-painted aluminum sheet sqft'  B: 40  D: 'LEDs 1 sign'  E: 0 ← =(((B7*B8)/144))*H46  F: '\xa0'
r54  A: 'Sheets of pre-painted aluminum'  B: 1 ← =B6  D: 'Power supplies 1 sign'  E: 0 ← =ROUNDUP(E53/H47,0)  F: '\xa0'
r55  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22
r57  A: 'speed table lookup'
r58  A: 0 ← =RateData!B61  B: 0.95 ← =RateData!D61
r59  A: 4 ← =RateData!B62  B: 1.9 ← =RateData!D62
r60  A: 8 ← =RateData!B63  B: 2.85 ← =RateData!D63
r61  A: 18 ← =RateData!B64  B: 3.8 ← =RateData!D64
---
```

## `Df acrylic cabinet`

```
r 1  A: 'Df Acrylic cabinet'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 4  B: 'Acrylic'  C: '<<< Choose White acrylic or White Polyca…'
r 5  B: 'Rectangular'  C: '<<< Choose Rectangular or Radius/Angle s…'
r 6  B: 0  C: '<<< Choose number of extra paint colors …'
r 7  B: 0  C: '<<< Rows of Divider Bar '
r 8  A: 'Number of signs?'  B: 1
r 9  A: 'Height inches?'  B: 0
r10  A: 'Length inches?'  B: 0
r11  A: 'Depth inches?'  B: 0
r12  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: 'Div Bar 2.5 Alum'  B: '22005' ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 4.287 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 7.717 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'FT' ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF( B7<>0,CEILING(((B7*B10*B8)/12)*B46,10),0)  I: 0 ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 0.95 ← =VLOOKUP(E33,A61:B64,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53  F: 19 ← =E49  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53  F: 23.75 ← =E50  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47*B46  F: 14.25 ← =E51  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B51  F: 40 ← =H46  G: 0 ← =CEILING(E37/F37,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  A: 2312  B: 'Plastic Face Labor' ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B51  F: 72 ← =E48  G: 0 ← =CEILING(E38/F38,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G38*H38,"")
r39  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'Radius/angles'  G: 0 ← =IF(B5="Radius/Angle",CEILING(G33*H50,RateData!B84),0)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'extra paint colors'  G: 0 ← =IF(B53<> 0,B6,0)  H: 97 ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G40*H40,"")
r41  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'divider bar labor'  E: 0 ← =(B7*B10*B8)/12*B46  F: 8 ← =E57  G: 0 ← =IF(B7<>0,CEILING(E41/F41,RateData!B84),0)  H: 97 ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'double face'  B: 2  D: 'Grams of paint/sqft'  E: 100 ← =RateData!B4  G: 'Retainer assembly sqft/hour'  H: 40 ← =RateData!B35
r47  A: 'sqft'  B: 0 ← =(B9*B10/144)*B8  D: 'Quickmod 12 volt LEDs/sqft'  E: 1.5 ← =RateData!B21  G: 'Extra paint color percentage'  H: 0.1 ← =RateData!B5
r48  A: 'perimeter ft'  B: 0 ← =(((B9+B10)*2)/12)*B8  D: 'Acrylic cut sqft/hour'  E: 72 ← =RateData!B23  G: 'extra paint color materials'  H: 0 ← =B6*B53*H47*E46
r49  A: 'perimeter ft X 2'  B: 0 ← =B48*2  D: 'Cabinet paint prep sqft/hour'  E: 19 ← =RateData!B6  G: 'Rectangular'  H: 0
r50  A: 'perimeter ft X3'  B: 0 ← =B48*3  D: 'Cabinet paint sqft/hour'  E: 23.75 ← =RateData!B7  G: 'Radius/Angle'  H: 0.25 ← =RateData!B16
r51  A: 'sqft of faces'  B: 0 ← =B46*B47  D: 'LED wiring sqft/hour'  E: 14.25 ← =RateData!B18  G: 0  H: 'number of colors list'
r52  A: 'sqft of filler'  B: 0 ← =B48*(B11/12)  D: 'LEDs 1 sign'  E: 0 ← =(((B9*B10)/144)*B46)*E55  G: 1
r53  A: 'paint area w/filler'  B: 0 ← =B52+B54  D: 'Power supplies 1 sign'  E: 0 ← =ROUNDUP(E52/E56,0)  F: '\xa0'  G: 2
r54  A: 'retainer ft'  B: 0 ← =B49  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22  F: '\xa0'  G: 3
r55  A: 'pole nest ft'  B: 0 ← =B11*4/12*B8  D: 'Synergy 24 volt LEDs/sqft'  E: 1.3 ← =RateData!B19  G: 4
r56  A: 'ACM supports ft'  B: 0 ← =(B9*4/12)*B8  D: 'Synergy 24 volt LEDs/power supply'  E: 108 ← =RateData!B20  G: 5
r57  A: 'ACM sheets'  B: 0 ← =CEILING(B51/32,0.5)  D: 'Divider bar ft/hr'  E: 8 ← =RateData!B85  G: 0  H: 'number of divider bars'
r58  G: 1
r59  G: 2
r60  A: 'speed table lookup'  G: 3
r61  A: 0 ← =RateData!B61  B: 0.95 ← =RateData!D61  G: 4
r62  A: 4 ← =RateData!B62  B: 1.9 ← =RateData!D62  G: 5
r63  A: 8 ← =RateData!B63  B: 2.85 ← =RateData!D63  D: 'Acrylic'  G: 6
r64  A: 18 ← =RateData!B64  B: 3.8 ← =RateData!D64  D: 'Polycarbonate'  G: 7
r65  G: 8
r66  G: 9
r67  G: 10
---
```

## `Sf flex cabinet`

```
r 1  A: 'Sf Flex Cabinet'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2  C: 'Use kerf cut extrusion kit for radius or…'
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 5  B: 0  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of signs?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 1.9 ← =VLOOKUP(E33,A58:B60,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B52  F: 20  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B52  F: 25  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 15  G: 0 ← =CEILING(E36/F36,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 40 ← =H46  G: 0 ← =CEILING(E37/F37,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  A: 2316  B: 'Flex Face Assembly Labor' ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 15 ← =E48  G: 0 ← =CEILING(E38/F38,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G38*H38,"")
r39  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'extra paint color'  G: 0 ← =IF(B52<> 0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =((B7*B8)/144)*B6  D: 'Grams of paint/sqft'  E: 100 ← =RateData!B4  G: 'Retainer assembly sqft/hour'  H: 40 ← =RateData!B35
r47  A: 'perimeter ft'  B: 0 ← =(((B7+B8)*2)/12)*B6  D: 'Quickmod 12 volt LEDs/sqft'  E: 1.5 ← =RateData!B21  G: 'Extra paint color percentage'  H: 0.1 ← =RateData!B5
r48  A: 'perimeter ft X 2'  B: 0 ← =B47*2  D: 'Flex face assembly sqft/hour'  E: 15 ← =RateData!B36  G: 'Extra paint color material'  H: 0 ← =B52*H47*E46*B5
r49  A: 'perimeter ft X3'  B: 0 ← =B47*3  G: 0  H: 'number of colors list'
r50  A: 'sqft of faces'  B: 0 ← =B46  D: 'Cabinet paint prep sqft/hour'  E: 19 ← =RateData!B6  G: 1
r51  A: 'sqft of filler'  B: 0 ← =B47*(B9/12)  D: 'Cabinet paint sqft/hour'  E: 23.75 ← =RateData!B7  G: 2
r52  A: 'paint area w/filler'  B: 0 ← =B51+B53  D: 'LED wiring sqft/hour'  E: 14.25 ← =RateData!B18  G: 3
r53  A: 'retainer ft'  B: 0 ← =B47  D: 'LEDs 1 sign'  E: 0 ← =((B7*B8)/144)*E56  F: '\xa0'  G: 4
r54  D: 'Power supplies 1 sign'  E: 0 ← =ROUNDUP(E53/E57,0)  F: '\xa0'  G: 5
r55  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22
r56  D: 'Synergy 24 volt LEDs/sqft'  E: 1.3 ← =RateData!B19
r57  A: 'speed table lookup'  D: 'Synergy 24 volt LEDs/power supply'  E: 108 ← =RateData!B20
r58  A: 0 ← =RateData!B65  B: 1.9 ← =RateData!D65
r59  A: 32 ← =RateData!B66  B: 2.38 ← =RateData!D66
r60  A: 80 ← =RateData!B67  B: 2.85 ← =RateData!D67
---
```

## `Df flex cabinet`

```
r 1  A: 'Df Flex Cabinet'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2  C: 'Use kerf cut extrusion kit for radius or…'
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 5  B: 1  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of signs?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 0
r10  A: 'Alum angle or steel tube frame?'  B: 'Alum Angle'  C: '<<< Choose frame material (if over 80 sq…'
r11  A: 'Standard retainers or bleed face retaine…'  B: 'Standard'  C: '<<< Choose retainer style (if bleed choo…'
r12  A: 'Type of face attachment?'  B: 'Screws'  C: '<<< Choose face attachment (if steel tub…'
r13  A: 'Total price'  B: 0 ← =SUM(I17:I51)
r15  A: 'Inventory items'
---
r30  A: '2 X 2 X .187 Sq Tube'  B: '29525' ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 3.66 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 6.589 ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'FT' ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF((B10="Steel Tube"),CEILING(B56,10),0)  I: 0 ← =IFERROR(E30*G30,"")
r31  A: '1.25 X 1.25 X .187 Angle Iron'  B: '28025' ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 1.05 ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 1.89 ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'FT' ← =IFERROR(VLOOKUP(A31,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF(B10="Steel Tube",IF(B11="STANDARD",CEILING(B55,10),0),0)  I: 0 ← =IFERROR(E31*G31,"")
r32  A: 'SignComp 2107 Flat Bleed Retro Frame II'  B: '22110' ← =IFERROR(VLOOKUP(A32,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 8.556 ← =IFERROR(VLOOKUP(A32,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 15.402 ← =IFERROR(VLOOKUP(A32,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'FT' ← =IFERROR(VLOOKUP(A32,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF(B11="Bleed",CEILING(B60,20),0)  I: 0 ← =IFERROR(E32*G32,"")
r33  A: 'Signcomp #2093 Bleed Cover'  B: '22045' ← =IFERROR(VLOOKUP(A33,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 2.6 ← =IFERROR(VLOOKUP(A33,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 4.68 ← =IFERROR(VLOOKUP(A33,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'FT' ← =IFERROR(VLOOKUP(A33,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF(B11="Bleed",CEILING(B60,20),0)  I: 0 ← =IFERROR(E33*G33,"")
r34  A: 'Flex Face Clip w/Bolt @ bar'  B: '50000' ← =IFERROR(VLOOKUP(A34,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 2.152 ← =IFERROR(VLOOKUP(A34,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 3.874 ← =IFERROR(VLOOKUP(A34,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'EA' ← =IFERROR(VLOOKUP(A34,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF((B12="Metal Clips"),CEILING(E65*B55,1),0)  I: 0 ← =IFERROR(E34*G34,"")
r35  A: 'SignComp Flex Tension Clip'  B: '50005' ← =IFERROR(VLOOKUP(A35,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 0.12 ← =IFERROR(VLOOKUP(A35,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 0.216 ← =IFERROR(VLOOKUP(A35,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'EA' ← =IFERROR(VLOOKUP(A35,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF((B12="Plastic Clips"),CEILING(E66*B55,1),0)  I: 0 ← =IFERROR(E35*G35,"")
r36  A: '1.5 X 1.5 X .125 Angle Iron'  B: '28040' ← =IFERROR(VLOOKUP(A36,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: 0.738 ← =IFERROR(VLOOKUP(A36,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: 1.329 ← =IFERROR(VLOOKUP(A36,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: 'FT' ← =IFERROR(VLOOKUP(A36,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  G: 0 ← =IF((B10="Steel Tube"), CEILING(B62,10),0)  I: 0 ← =IFERROR(E36*G36,"")
r37  A: 'Shop labor'
r38  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r39  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53  F: 1.9 ← =VLOOKUP(E39,A66:B68,2,TRUE)  G: 0 ← =CEILING(E39/F39,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G39*H39,"")
r40  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B59  F: 19 ← =E55  G: 0 ← =CEILING(E40/F40,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G40*H40,"")
r41  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B59  F: 23.75 ← =E56  G: 0 ← =CEILING(E41/F41,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G41*H41,"")
r42  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53*B52  F: 14.25 ← =E57  G: 0 ← =CEILING(E42/F42,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G42*H42,"")
r43  A: 2215  B: 'Assembly Labor' ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B57  F: 40 ← =H55  G: 0 ← =CEILING(E43/F43,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G43*H43,"")
r44  A: 2316  B: 'Flex Face Assembly Labor' ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B57  F: 15 ← =E54  G: 0 ← =CEILING(E44/F44,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G44*H44,"")
r45  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A45,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'extra paint color'  G: 0 ← =IF(B59<> 0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A45,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G45*H45,"")
r46  B: None ← =IFERROR(VLOOKUP(A46,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A46,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G46*H46,"")
r47  B: None ← =IFERROR(VLOOKUP(A47,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A47,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G47*H47,"")
r48  B: None ← =IFERROR(VLOOKUP(A48,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A48,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G48*H48,"")
r49  B: None ← =IFERROR(VLOOKUP(A49,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A49,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G49*H49,"")
r50  B: None ← =IFERROR(VLOOKUP(A50,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A50,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G50*H50,"")
r51  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r52  A: 'double face'  B: 2  D: 'Grams of paint/sqft'  E: 100 ← =RateData!B4  G: 'Synergy 24 volt LEDs/sqft'  H: 1.3 ← =RateData!B19
r53  A: 'sqft'  B: 0 ← =(B7*B8/144)*B6  D: 'Quickmod 12 volt LEDs/sqft'  E: 1.5 ← =RateData!B21  G: 'Synergy 24 volt LEDs/power supply'  H: 108 ← =RateData!B20
r54  A: 'perimeter ft'  B: 0 ← =(((B7+B8)*2)/12)*B6  D: 'Flex face assembly sqft/hour'  E: 15 ← =RateData!B36
r55  A: 'perimeter ft X 2'  B: 0 ← =B54*2  D: 'Cabinet paint prep sqft/hour'  E: 19 ← =RateData!B6  G: 'Retainer assembly sqft/hour'  H: 40 ← =RateData!B35
r56  A: 'perimeter ft X3'  B: 0 ← =B54*3  D: 'Cabinet paint sqft/hour'  E: 23.75 ← =RateData!B7  G: 'Extra paint color percentage'  H: 0.1 ← =RateData!B5
r57  A: 'sqft of faces'  B: 0 ← =B52*B53  D: 'LED wiring sqft/hour'  E: 14.25 ← =RateData!B18  G: 'Extra paint color material'  H: 0 ← =B59*H56*E52*B5
r58  A: 'sqft of filler'  B: 0 ← =B54*(B9/12)  D: 'LEDs 1 sign'  E: 0 ← =(((B7*B8)/144)*B52)*H52  F: '\xa0'  G: 0  H: 'number of colors list'
r59  A: 'paint area w/filler'  B: 0 ← =B58+B60  D: 'Power supplies 1 sign'  E: 0 ← =ROUNDUP(E58/H53,0)  F: '\xa0'  G: 1
r60  A: 'retainer ft'  B: 0 ← =B55  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22  G: 2
r61  A: 'pole nest ft'  B: 0 ← =(B9*4/12)*B6  G: 3
r62  A: 'ACM supports ft'  B: 0 ← =(B7*4/12)*B6  D: 'Alum Angle'  F: 'Standard'  G: 4
r63  A: 'ACM sheets'  B: 0 ← =CEILING(B57/32,0.5)  D: 'Steel Tube'  F: 'Bleed'  G: 5
r64  D: 'Screws'
r65  A: 'speed table lookup'  D: 'Metal Clips'  E: 1.34 ← =RateData!B38
r66  A: 0 ← =RateData!B65  B: 1.9 ← =RateData!D65  D: 'Plastic Clips'  E: 2 ← =RateData!B37
r67  A: 32 ← =RateData!B66  B: 2.38 ← =RateData!D66  D: 'WC code adjusted lines, INV code needs u…'
r68  A: 80 ← =RateData!B67  B: 2.85 ← =RateData!D67  D: '12-5-23 added tube frame retainer and fa…'
---
```

## `Pole cover`

```
r 1  A: 'Pole cover or large reveals/ornaments'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 4  B: 'Rectangular'  C: '<<< Choose Rectangular or Radius/Angle s…'
r 5  B: 0  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of polecovers?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 0.95 ← =VLOOKUP(E33,A57:B60,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53  F: 19 ← =E47  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B53  F: 23.75 ← =E48  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'extra paint color'  G: 0 ← =IF(B53<> 0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G36*H36,"")
r37  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'radius/angle'  G: 0 ← =IF(B4="Radius/Angle",G33*E51,0)  H: 97 ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r46  A: 'double face by definition'  B: 2  D: 'Grams of paint/sqft'  E: 100 ← =RateData!B4  F: 0  G: 'number of colors list'
r47  A: 'sqft'  B: 0 ← =((B7*B8)/144)*B6  D: 'Cabinet paint prep sqft/hour'  E: 19 ← =RateData!B6  F: 1
r48  A: 'perimeter ft'  B: 0 ← =(((B7+B8)*2)/12)*B6  D: 'Cabinet paint sqft/hour'  E: 23.75 ← =RateData!B7  F: 2
r49  A: 'perimeter ft X 2'  B: 0 ← =B48*2  F: 3
r50  A: 'perimeter ft X3'  B: 0 ← =B48*3  D: 'Rectangular'  E: 0  F: 4
r51  A: 'sqft of faces'  B: 0 ← =B47*B46  D: 'Radius/Angle'  E: 0.25 ← =RateData!B16  F: 5
r52  A: 'sqft of filler'  B: 0 ← =(B9/12)*B48  D: 'Extra paint color percentage'  E: 0.1 ← =RateData!B5
r53  A: 'paint area w/filler'  B: 0 ← =B52+B51  D: 'extra paint color materials'  E: 0 ← =B53*E52*E46*B5
r54  A: 'pole nest ft'  B: 0 ← =((B9*4)/12)*B6
r55  D: 'large pole cover size for face material …'  E: 50 ← =RateData!B81
r56  A: 'Speed table lookup'  D: 'large pole cover frame multiplier'  E: 1.3 ← =RateData!B82
r57  A: 0 ← =RateData!B68  B: 0.95 ← =RateData!D68  D: 'large pole cover size for frame multipli…'  E: 61 ← =RateData!B83
r58  A: 5 ← =RateData!B69  B: 1.9 ← =RateData!D69
r59  A: 25 ← =RateData!B70  B: 2.85 ← =RateData!D70
r60  A: 50 ← =RateData!B71  B: 3.8 ← =RateData!D71
---
```

## `Structural Steel Fab`

```
r 1  A: 'Structural Steel Fabrication'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 7  A: 'ALL MANUAL INPUT'
r 8  A: 'Choose Inventory item enter Units Needed'
r 9  A: 'Choose labor work code enter Estimated H…'
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r14  A: 'Inventory items '
r15  A: 'Choose all inventory items needed by des…'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor '  G: 'Enter Estimated Hours '
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2016  B: 'Structural Steel Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  G: 0  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'
---
```

## `Reveal`

```
r 1  A: 'Reveal'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2  C: 'If reveal is less than 1" or greater tha…'
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of reveals?'  B: 1
r 7  A: 'Height inches?'  B: 3  C: '<<< Choose reveal height only 1", 2", 3"…'
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Ft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 9.5 ← =VLOOKUP(E33,A54:C55,3,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B48  F: 15 ← =B49  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B48  F: 15 ← =B50  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateDate sheet'
r46  A: 'perimeter ft'  B: 0 ← =(((B9+B8)*2)/12)*B6  E: 'post size list'  F: 1
r47  A: 'feet of angle support'  B: 0 ← =((B9/12)*4)*B6  F: 2
r48  A: 'sqft of painting'  B: 0 ← =B46  F: 3
r49  A: 'Reveal paint prep sqft/hour'  B: 15 ← =RateData!B12  F: 4
r50  A: 'Reveal paint sqft/hour'  B: 15 ← =RateData!B13
r51  A: 'Grams of paint/sqf'  B: 100 ← =RateData!B4
r53  A: 'speed table lookup'
r54  A: 0 ← =RateData!B72  C: 9.5 ← =RateData!D72
r55  A: 20 ← =RateData!B73  C: 6.65 ← =RateData!D73
---
```

## `Crown cove top`

```
r 1  A: 'Crowned or Cove Top Cap'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of crown tops?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches?'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 1.9 ← =VLOOKUP(E33,A56:C57,3,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 6 ← =B51  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B50  F: 15 ← =B52  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'perimeter of top'  B: 0 ← =(((B9+B8)*2)/12)*B6
r47  A: 'feet of angle support'  B: 0 ← =((B9/12)*4)*B6
r48  A: 'sqft of reveal perimeter'  B: 0 ← =B46*(B7/12)
r49  A: 'sqft of top'  B: 0 ← =((B8*B9)/144)*B6
r50  A: 'sqft to paint'  B: 0 ← =B49+B48
r51  A: 'Crown paint bondo & prep sqft/hour'  B: 6 ← =RateData!B14
r52  A: 'Crown paint sqft/hour'  B: 15 ← =RateData!B15
r53  A: 'Grams of paint/sqft'  B: 100 ← =RateData!B4
r55  A: 'speed table lookup'
r56  A: 0 ← =-RateData!B74  C: 1.9 ← =RateData!D74
r57  A: 20 ← =RateData!B75  C: 3.8 ← =RateData!D75
---
```

## `EMC assembly`

```
r 1  A: 'EMC Fabrication and Assembly'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 5  C: 'Standard pre-painted black aluminum fill…'
r 6  A: 'Number of signs?'  B: 1
r 7  A: 'EMC height inches?'  B: 0
r 8  A: 'EMC length inches?'  B: 0
r 9  A: 'Assembled depth inches?'  B: 0
r10  A: 'Steel or aluminum frame?'  B: 'Steel'  C: '<<<Choose steel or aluminum frame (steel…'
r11  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2011  B: 'Cabinet Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 2.85 ← =VLOOKUP(E33,A52:B56,2,TRUE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2216  B: 'Electronics Wiring & Assembly Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 2.85 ← =VLOOKUP(E34,A52:B56,2,TRUE)  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =WC!B3  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2116  B: 'Hand Painting Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =IF(B10="STEEL", B46,0)  F: 20 ← =B50  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  B: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =((B7*B8)/144)*B6  D: 'Steel'
r47  A: 'filler sqft'  B: 0 ← =B48*(B9/12)  D: 'Aluminum'
r48  A: 'perimeter'  B: 0 ← =(((B7+B8)*2)/12)*B6
r49  A: 'perimeter X 2'  B: 0 ← =B48*2
r50  A: 'EMC hand paint sqft/hour'  B: 20 ← =RateData!B39
r52  A: 0 ← =RateData!B76  B: 2.85 ← =RateData!D76
r53  A: 10 ← =RateData!B77  B: 3.8 ← =RateData!D77
r54  A: 33 ← =RateData!B78  B: 4.75 ← =RateData!D78
r55  A: 65 ← =RateData!B79  B: 6.65 ← =RateData!D79
r56  A: 100 ← =RateData!B80  B: 9.5 ← =RateData!D80
---
```

## `Crating`

```
r 1  A: 'Crating'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 7  A: 'ALL MANUAL INPUT'
r 8  A: 'Choose Inventory item enter Units Needed'
r 9  A: 'Choose labor work code enter Estimated H…'  B: 'Choose labor work code enter Estimated H…'
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r14  A: 'Inventory items '
r15  A: 'Choose all inventory items needed by des…'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor  '  G: 'Enter Estimated Hours'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2217  B: 'Crating Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  G: 0  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'
---
```

## `LED wiring`

```
r 1  A: 'LED Wiring'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 5  B: 'Yes'  C: '<<< Include ACM panels for LED illuminat…'
r 6  A: 'Number of Faces?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2212  B: 'LED Wiring Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 14.25 ← =B48  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  D: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =((B7*B8)/144)*B6  D: 'LEDs 1 sign'  E: 0 ← =(B7*B8)/144*H46  F: '\xa0'  G: 'Synergy 24 volt LEDs/sqft'  H: 1.3 ← =RateData!B19
r47  A: 'Quickmod 12 volt LEDs/sqft'  B: 1.5 ← =RateData!B21  D: 'Power supplies 1 sign'  E: 0 ← =CEILING(E46/H47,1)  F: '\xa0'  G: 'Synergy 24 volt LEDs/power supply'  H: 108 ← =RateData!B20
r48  A: 'LED wiring sqft/hour'  B: 14.25 ← =RateData!B18  D: 'Quickmod 12 volt LEDs/power supply'  E: 50 ← =RateData!B22
r49  A: 'ACM'  B: 0 ← =CEILING(B46/32,0.5)
r50  G: 'Yes'
r51  G: 'No'
---
```

## `Changeable copy face`

```
r 1  A: 'Changeable Copy Face'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 5  B: 'Manually enter footage of rails as neede…'
r 6  A: 'Number of faces?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r13  F: 'Manually enter footage of rails as neede…'
r14  A: 'Inventory items'
r15  A: 'Enter track footage manually'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2315  B: 'Face Assembly Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'cut face to size'  E: 0 ← =B46  F: 72 ← =B48  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2315  B: 'Face Assembly Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: 'assemble rails'  E: 0 ← =G18+G19+G20  F: 16 ← =B47  G: 0 ← =E34/F34  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'Sqft'  B: 0 ← =(B7*B8/144)*B6
r47  A: 'CC rail fab feet/hour'  B: 16 ← =RateData!B40
r48  A: 'plastic face fabrication'  B: 72 ← =RateData!B23
---
```

## `Flex face assembly`

```
r 1  A: 'Flex Face Assembly'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of faces?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Include clips?'  B: 'No'  C: '<<< Choose yes or no (default is screw a…'
r10  A: 'Type of clip?'  B: 'Metal'  C: '<<< Choose metal or plastic'
r11  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2316  B: 'Flex Face Assembly Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 15 ← =B47  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  E: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8*B6)/144  D: 'modified 12-5-23 to use EST MISC Hardwar…'
r47  A: 'Flex face assembly sqft/hour'  B: 15 ← =RateData!B36
r48  A: 'perimeter ft'  B: 0 ← =(B7+B8)*2/12*B6
r49  A: 'No'
r50  A: 'Yes'
r52  A: 'lookup clips per foot'
r53  A: 'metal face clamps every 9" = 1.34/foot '
r54  A: 'Plastic Signcomp every 6" = 2/foot '
r55  A: 'No'  B: 0
r56  A: 'Metal'  B: 1.34 ← =RateData!B38
r57  A: 'Plastic'  B: 2 ← =RateData!B37
---
```

## `Routed face assembly`

```
r 1  A: 'Routed Face Assembly'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of faces?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2313  B: 'Routed Face Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B46  F: 15 ← =B47  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  C: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8)*B6/144
r47  A: 'Routed backer assembly sqft/hour'  B: 15 ← =RateData!B33
---
```

## `Paint calculation`

```
r 1  A: 'Paint Calculation'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 5  B: 0  C: '<<< Choose number of extra paint colors …'
r 6  A: 'Number of faces?'  B: 1
r 7  A: 'Height inches?'  B: 0
r 8  A: 'Length inches?'  B: 0
r 9  A: 'Depth inches? (flat is 0)'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Sqft to Process'  F: 'Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B48  F: 19 ← =B50  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B48  F: 23.75 ← =B51  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  D: 'extra paint color'  G: 0 ← =IF(B48<> 0,B5,0)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  D: 'Data in RateData sheet'
r46  A: 'sqft'  B: 0 ← =(B7*B8*B6)/144  D: 'Extra paint color percentage'  E: 0.1 ← =RateData!B5  G: 0  H: 'number of colors list'
r47  A: 'sqft of filler'  B: 0 ← =((B7+B8)*2)*B9/144  D: 'extra paint color materials'  E: 0 ← =B48*E46*B49*B5  G: 1
r48  A: 'area to paint'  B: 0 ← =B46+B47  G: 2
r49  A: 'Grams of paint/sqft'  B: 100 ← =RateData!B4  G: 3
r50  A: 'Cabinet paint prep sqft/hour'  B: 19 ← =RateData!B6  G: 4
r51  A: 'Cabinet paint sqft/hour'  B: 23.75 ← =RateData!B7  G: 5
---
```

## `Trimcap letter face`

```
r 1  A: 'Trimcap Letter Face'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of Letters?'  B: 1
r 7  A: 'Height of letters inches?'  B: 0
r 8  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Inches to Process'  F: 'Inches/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2314  B: 'Trim Cap Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 21 ← =G46  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  B: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G34*H34,"")
r35  B: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  E: 'Data in RateData sheet'
r46  A: 'Letter perimeter path factor'  B: 6 ← =RateData!B28  E: 'Trim cap face fab inches/hour'  G: 21 ← =RateData!B41  H: 'inches/hr'
r47  A: 'inches of letter fab'  B: 0 ← =B6*B7
r48  A: 'letter perimeter inches'  B: 0 ← =(B47*B46)
r49  A: 'sqft of backs'  B: 0 ← =(B6*B7*(B7*0.75))/144
---
```

## `Channel letter fabrication`

```
r 1  A: 'Channel Letter Fabrication'
r 2  A: 'Job number'  B: 0 ← ='HEADER INFO'!B2
r 3  A: 'Job name'  B: 0 ← ='HEADER INFO'!B3
r 6  A: 'Number of Letters?'  B: 1
r 7  A: 'Letter style?'  B: 'Block'  C: '<<< Choose style'
r 8  A: 'Height of letters inches?'  B: 0
r 9  A: 'Depth of letters inches?'  B: 0
r10  A: 'Total price'  B: 0 ← =SUM(I17:I44)
r15  A: 'Inventory items'
---
r30  A: '\xa0'  B: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,2,FALSE),"")  C: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,3,FALSE),"")  E: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,4,FALSE),"")  F: None ← =IFERROR(VLOOKUP(A30,Inv!$A$3:'Inv'!$E$2002,5,FALSE),"")  I: None ← =IFERROR(E30*G30,"")
r31  A: 'Shop labor'
r32  A: 'Labor Work Code #'  B: 'Work Code Description'  E: 'Inches or Sqft to Process'  F: 'Inches or Sqft/Hr'  G: 'Estimated Hours'  H: 'Hourly Rate'  I: 'Total'
r33  A: 2014  B: 'Letter Metal Labor' ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B47  F: 18 ← =VLOOKUP(B7,A54:B56,2,FALSE)  G: 0 ← =CEILING(E33/F33,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A33,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G33*H33,"")
r34  A: 2110  B: 'Paint Prep Labor' ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B51  F: 15 ← =G46  G: 0 ← =CEILING(E34/F34,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A34,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G34*H34,"")
r35  A: 2112  B: 'Paint Cabinet & Letters Labor' ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,2,FALSE),"")  E: 0 ← =B51  F: 15 ← =G47  G: 0 ← =CEILING(E35/F35,RateData!B84)  H: 97 ← =IFERROR(VLOOKUP(A35,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: 0 ← =IFERROR(G35*H35,"")
r36  B: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A36,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G36*H36,"")
r37  B: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A37,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G37*H37,"")
r38  B: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A38,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G38*H38,"")
r39  B: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A39,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G39*H39,"")
r40  B: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A40,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G40*H40,"")
r41  B: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A41,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G41*H41,"")
r42  B: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A42,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G42*H42,"")
r43  A: None ← =IFERROR(#REF!*#REF!,"")  B: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,2,FALSE),"")  C: None ← =IFERROR(#REF!*A43,"")  D: None ← =IFERROR(#REF!*B43,"")  E: None ← =IFERROR(A43*C43,"")  F: None ← =IFERROR(B43*D43,"")  G: None ← =IFERROR(C43*E43,"")  H: None ← =IFERROR(VLOOKUP(A43,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G43*H43,"")  J: None ← =IFERROR(F43*H43,"")  K: None ← =IFERROR(G43*I43,"")  L: None ← =IFERROR(H43*J43,"")  M: None ← =IFERROR(I43*K43,"")
r44  B: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,2,FALSE),"")  H: None ← =IFERROR(VLOOKUP(A44,WC!$A$6:'WC'!$C$30,3,FALSE),"")  I: None ← =IFERROR(G44*H44,"")
r45  A: 'Formula calculation details below DO NOT…'  E: 'Data in RateData sheet'
r46  A: 'Letter perimeter path factor'  B: 6 ← =RateData!B28  E: 'Channel letter paint prep sqft/hour'  G: 15 ← =RateData!B45
r47  A: 'inches of letter fab'  B: 0 ← =B6*B8  E: 'Channel letter paint sqft/hour'  G: 15 ← =RateData!B46
r48  A: 'letter perimeter inches'  B: 0 ← =(B47*B46)  E: 'Grams of paint/sqft'  G: 100 ← =RateData!B4
r49  A: 'sqft of backs'  B: 0 ← =CEILING((B8*B8)/144,10)*B6
r50  A: 'sqft of filler'  B: 0 ← =(B48*B9)/144
r51  A: 'sqft to paint'  B: 0 ← =B49+B50
r53  A: 'speed lookup table'
r54  A: 'Block'  B: 18 ← =RateData!B42
r55  A: 'Serif'  B: 12 ← =RateData!B43
r56  A: 'Script'  B: 8 ← =RateData!B44
---
```
