import GridDistortion from '../components/GridDistortion'

/**
 * Demo page for GridDistortion.
 * Usage example:
 *
 * <div style={{ width: '100%', height: '600px', position: 'relative' }}>
 *   <GridDistortion
 *     imageSrc="https://picsum.photos/1920/1080?grayscale"
 *     grid={10}
 *     mouse={0.1}
 *     strength={0.15}
 *     relaxation={0.9}
 *     className="custom-class"
 *   />
 * </div>
 */
export default function GridDistortionDemo() {
  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-xl font-semibold text-white">
          GridDistortion demo
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Move the mouse over the image to distort it.
        </p>
        <div
          className="overflow-hidden rounded-2xl border border-white/10"
          style={{ width: '100%', height: '600px', position: 'relative' }}
        >
          <GridDistortion
            imageSrc="https://picsum.photos/1920/1080?grayscale"
            grid={10}
            mouse={0.1}
            strength={0.15}
            relaxation={0.9}
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  )
}
