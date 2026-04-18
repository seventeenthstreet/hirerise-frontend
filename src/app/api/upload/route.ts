// app/api/upload/route.ts

export async function GET() {
  return Response.json({ message: 'Upload route working ✅' });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Debug log (you'll see this in terminal)
    console.log('File received:', file);

    return Response.json({
      message: 'File received successfully ✅',
    });

  } catch (error) {
    console.error('Upload error:', error);

    return Response.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}