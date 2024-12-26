import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';

export async function POST(req: NextRequest) {
  const data = await req.formData();
  const file: File | null = data.get('file') as unknown as File;

  if (!file) {
    return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  try {
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true
    });

    // Assuming the CSV has 'rainfall' and 'yield' columns
    const processedData = records.map((record: { rainfall: string; yield: string; }) => ({
      rainfall: parseFloat(record.rainfall),
      yield: parseFloat(record.yield)
    }));

    return NextResponse.json({ success: true, data: processedData });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json({ success: false, message: 'Error parsing CSV file' }, { status: 500 });
  }
}

